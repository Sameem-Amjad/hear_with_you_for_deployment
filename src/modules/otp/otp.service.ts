import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpRecord, OtpType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { generateSixDigitOtp } from '../../common/utils/otp.util';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  generateOtp(): string {
    return generateSixDigitOtp();
  }

  async createOtp(
    identifier: string,
    type: OtpType,
    purpose: OtpPurpose,
  ): Promise<{ otp: string; expiresIn: number }> {
    await this.assertRateLimit(identifier);

    const plainOtp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(plainOtp, 12);
    const expiryMinutes =
      this.configService.getOrThrow<number>('OTP_EXPIRY_MINUTES');
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.prismaService.$transaction([
      this.prismaService.otpRecord.updateMany({
        where: { identifier, type, purpose, isUsed: false },
        data: { isUsed: true },
      }),
      this.prismaService.otpRecord.create({
        data: {
          identifier,
          otp: hashedOtp,
          type,
          purpose,
          expiresAt,
        },
      }),
    ]);

    this.logger.log(`Generated OTP for ${identifier} (${purpose})`);
    return { otp: plainOtp, expiresIn: expiryMinutes * 60 };
  }

  async verifyOtp(
    identifier: string,
    otp: string,
    type: OtpType,
    purpose: OtpPurpose,
  ): Promise<{
    valid: boolean;
    otpRecord?: OtpRecord;
    error?: string;
    remainingAttempts?: number;
  }> {
    const otpRecord = await this.prismaService.otpRecord.findFirst({
      where: { identifier, type, purpose, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return { valid: false, error: 'OTP not found or already used' };
    }

    if (otpRecord.expiresAt < new Date()) {
      return { valid: false, error: 'OTP has expired' };
    }

    if (otpRecord.attempts >= 5) {
      return {
        valid: false,
        error: 'Maximum OTP attempts exceeded',
        remainingAttempts: 0,
      };
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otp);

    if (!isValid) {
      const updated = await this.prismaService.otpRecord.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });

      return {
        valid: false,
        error: 'Invalid OTP',
        remainingAttempts: Math.max(0, 5 - updated.attempts),
      };
    }

    this.logger.log(`Verified OTP for ${identifier} (${purpose})`);
    return { valid: true, otpRecord };
  }

  async markOtpAsUsed(otpId: string): Promise<void> {
    await this.prismaService.otpRecord.update({
      where: { id: otpId },
      data: { isUsed: true },
    });
  }

  private async assertRateLimit(identifier: string): Promise<void> {
    const isDev =
      process.env.NODE_ENV === 'development' ||
      this.configService.get('NODE_ENV') === 'development';
    const limitCount = isDev ? 1000 : 3;

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const count = await this.prismaService.otpRecord.count({
      where: {
        identifier,
        createdAt: {
          gte: fifteenMinutesAgo,
        },
      },
    });

    if (count >= limitCount) {
      throw new HttpException(
        'Too many OTP requests. Please try again after 15 minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  assertValidOtpResult(result: {
    valid: boolean;
    error?: string;
    remainingAttempts?: number;
  }): void {
    if (!result.valid) {
      throw new BadRequestException(
        result.remainingAttempts !== undefined
          ? `${result.error}. Remaining attempts: ${result.remainingAttempts}`
          : (result.error ?? 'OTP verification failed'),
      );
    }
  }
}
