import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { normalizeEmail } from '../../../common/utils/sanitizers.util';
import { FirebaseService } from '../../firebase/firebase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
    private readonly storageService: StorageService,
  ) {}

  private async resolveProfilePicture(profilePicture?: string | null) {
    if (!profilePicture) {
      return profilePicture;
    }

    return this.storageService.resolveAccessibleUrl(profilePicture);
  }

  private async generateUniqueUsername(seed?: string): Promise<string> {
    const normalizedSeed = (seed ?? 'admin')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/^[_-]+|[_-]+$/g, '');

    const base = (normalizedSeed || 'admin').slice(0, 24);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');
      const candidate = `${base}_${suffix}`;

      const existing = await this.prismaService.user.findFirst({
        where: {
          username: candidate,
          isDeleted: false,
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException('Unable to generate a unique username');
  }

  async login(dto: { email: string; password: string }) {
    const email = normalizeEmail(dto.email);
    const allow = (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!allow.includes(email)) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const user = await this.prismaService.user.findFirst({
      where: {
        email,
        isDeleted: false,
        isActive: true,
      },
    });

    if (!user?.passwordHash || !user.firebaseUid) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const token = await this.firebaseService.createCustomToken(user.firebaseUid);

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    return {
      message: 'Admin login successful',
      token,
      admin: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        profilePicture: await this.resolveProfilePicture(user.profilePicture),
      },
    };
  }

  async createAdmin(
    dto: {
      name: string;
      email: string;
      password: string;
      profilePicture?: string;
    },
    setupKey?: string,
  ) {
    const email = dto.email.toLowerCase();

    const configuredSetupKey = this.configService.get<string>('ADMIN_SETUP_KEY');
    if (!configuredSetupKey) {
      throw new BadRequestException('ADMIN_SETUP_KEY is not configured');
    }
    if (!setupKey || setupKey !== configuredSetupKey) {
      throw new BadRequestException('Invalid admin setup key');
    }

    const allow = (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allow.length === 0) {
      throw new BadRequestException(
        'ADMIN_EMAILS is empty. Configure allowed admin emails first.',
      );
    }
    if (!allow.includes(email)) {
      throw new BadRequestException(
        'Email is not present in ADMIN_EMAILS allowlist',
      );
    }

    const existingAdmins = await this.prismaService.user.findMany({
      where: {
        isDeleted: false,
        email: { in: allow },
      },
      select: { id: true, email: true },
      take: 1,
    });
    if (existingAdmins.length > 0) {
      throw new BadRequestException(
        'Admin bootstrap is disabled after first admin is created',
      );
    }

    const existing = await this.prismaService.user.findFirst({
      where: { email, isDeleted: false },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const firebaseUser = await this.firebaseService.createUser({
      email,
      password: dto.password,
      displayName: dto.name,
    });

    try {
      const username = await this.generateUniqueUsername(email);
      const passwordHash = await bcrypt.hash(dto.password, 12);

      const admin = await this.prismaService.user.create({
        data: {
          email,
          name: dto.name,
          username,
          profilePicture: dto.profilePicture,
          provider: 'EMAIL',
          passwordHash,
          firebaseUid: firebaseUser.uid,
          isProfileComplete: true,
          isActive: true,
          isDeleted: false,
          lastActiveAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      return {
        message:
          'Admin user created in database. Bootstrap endpoint is now disabled.',
        admin: {
          ...admin,
          profilePicture: await this.resolveProfilePicture(admin.profilePicture),
        },
      };
    } catch (error) {
      await this.firebaseService.deleteUser(firebaseUser.uid).catch(() => undefined);
      throw error;
    }
  }
}
