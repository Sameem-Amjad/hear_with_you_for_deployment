import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityService } from '../activity/activity.service';
import { SetupProfileDto } from './dto/setupprofile.dto';
import { UpdateProfileDto } from './dto/updateprofile.dto';
import { UserResponseDto } from './dto/userresponse.dto';
import { API_MESSAGES } from '../../common/constants/api.messages';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly activityService: ActivityService,
  ) {}

  async setupProfile(
    userId: string,
    dto: SetupProfileDto,
    profilePicture?: Express.Multer.File,
  ) {
    const currentUser = await this.findActiveUserById(userId);

    let profilePictureUrl: string | undefined;
    if (profilePicture) {
      profilePictureUrl = await this.storageService.uploadFile(
        profilePicture,
        'profilepictures',
      );
    }

    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        username:
          currentUser.username ??
          (await this.generateUniqueUsername(
            dto.name || currentUser.email || currentUser.phone || userId,
          )),
        name: dto.name,
        profilePicture: profilePictureUrl,
        isProfileComplete: true,
      },
    });

    await this.activityService.logActivity({
      userId,
      action: 'profile_setup',
      description: 'Profile setup completed',
    });

    return {
      message: API_MESSAGES.USER.SUCCESS.PROFILE_SETUP,
      user: UserResponseDto.fromUser(user),
    };
  }

  async getCurrentProfile(userId: string) {
    const user = await this.findActiveUserById(userId);
    return { user: UserResponseDto.fromUser(user) };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    profilePicture?: Express.Multer.File,
  ) {
    const currentUser = await this.findActiveUserById(userId);

    const data: Partial<User> = {};
    if (dto.name) data.name = dto.name;

    if (profilePicture) {
      const uploadedUrl = await this.storageService.uploadFile(
        profilePicture,
        'profilepictures',
      );
      if (currentUser.profilePicture) {
        await this.storageService.deleteFile(currentUser.profilePicture);
      }
      data.profilePicture = uploadedUrl;
    }

    const user = await this.prismaService.user.update({
      where: { id: userId },
      data,
    });

    await this.activityService.logActivity({
      userId,
      action: 'profile_update',
      description: 'Profile updated successfully',
      metadata: {
        changedFields: Object.keys(data),
      },
    });

    return {
      message: API_MESSAGES.USER.SUCCESS.PROFILE_UPDATED,
      user: UserResponseDto.fromUser(user),
    };
  }

  private async findActiveUserById(userId: string): Promise<User> {
    const user = await this.prismaService.user.findFirst({
      where: { id: userId, isDeleted: false, isActive: true },
    });
    if (!user) {
      throw new NotFoundException(API_MESSAGES.USER.ERROR.USER_NOT_FOUND);
    }
    return user;
  }

  private async generateUniqueUsername(seed: string): Promise<string> {
    const normalizedSeed = seed
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/^[_-]+|[_-]+$/g, '');

    const base = (normalizedSeed || 'user').slice(0, 24);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');
      const candidate = `${base}_${suffix}`;

      const existingUser = await this.prismaService.user.findFirst({
        where: {
          username: candidate,
          isDeleted: false,
        },
        select: { id: true },
      });

      if (!existingUser) {
        return candidate;
      }
    }

    throw new BadRequestException(API_MESSAGES.USER.ERROR.USERNAME_TAKEN);
  }
}
