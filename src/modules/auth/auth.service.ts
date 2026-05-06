import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProvider, OtpPurpose, OtpType, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationService } from '../notification/notification.service';
import { OtpService } from '../otp/otp.service';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import { ActivityService } from '../activity/activity.service';
import { StorageService } from '../storage/storage.service';
import { UserResponseDto } from '../user/dto/userresponse.dto';
import { RegisterPushTokenDto } from '../notification/dto/register-push-token.dto';
import { SocialLoginDto } from './dto/sociallogin.dto';
import { PLAN_IDS } from '../../common/constants/plan.constants';
import { EmailRegisterDto } from './dto/emailregister.dto';
import { VerifyEmailRegisterDto } from './dto/verifyemailregister.dto';
import { ForgotPasswordDto } from './dto/forgotpassword.dto';
import { VerifyForgotPasswordDto } from './dto/verifyforgotpassword.dto';
import { ResetPasswordDto } from './dto/resetpassword.dto';
import { PhoneRegisterDto } from './dto/phoneregister.dto';
import { VerifyPhoneRegisterDto } from './dto/verifyphoneregister.dto';
import { LoginPasswordDto } from './dto/loginpassword.dto';
import { ResendOtpDto } from './dto/resendotp.dto';
import {
  normalizeEmail,
  normalizePhone,
} from '../../common/utils/sanitizers.util';
import { API_MESSAGES } from '../../common/constants/api.messages';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly notificationService: NotificationService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly activityService: ActivityService,
    private readonly storageService: StorageService,
  ) {}

  private async buildUserResponse(user: User): Promise<UserResponseDto> {
    const profilePicture = user.profilePicture
      ? await this.storageService.resolveAccessibleUrl(user.profilePicture)
      : user.profilePicture;

    return UserResponseDto.fromUser({
      ...user,
      profilePicture,
    });
  }

  private async registerPushTokenIfProvided(params: {
    userId: string;
    fcmToken?: string;
    pushPlatform?: 'ios' | 'android' | 'web' | 'unknown';
  }): Promise<void> {
    if (!params.fcmToken) {
      return;
    }

    await this.notificationService.registerPushToken(params.userId, {
      token: params.fcmToken,
      platform: params.pushPlatform,
    });
  }

  async socialLogin(dto: SocialLoginDto) {
    const decoded = await this.firebaseService.verifyIdToken(dto.idToken);
    const email = decoded.email ? normalizeEmail(decoded.email) : undefined;
    const firebaseUid = decoded.uid;

    let user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ firebaseUid }, ...(email ? [{ email }] : [])],
        isDeleted: false,
      },
    });

    let isNewUser = false;
    if (!user) {
      const username = await this.generateUniqueUsername(
        typeof decoded.name === 'string' ? decoded.name : email,
      );
      user = await this.prismaService.user.create({
        data: {
          firebaseUid,
          username,
          email,
          name: typeof decoded.name === 'string' ? decoded.name : undefined,
          profilePicture:
            typeof decoded.picture === 'string' ? decoded.picture : undefined,
          provider: dto.provider,
          isProfileComplete: false,
          lastActiveAt: new Date(),
          currentSubscriptionPlanId: PLAN_IDS.FREE,
        },
      });
      isNewUser = true;
    } else {
      user = await this.prismaService.user.update({
        where: { id: user.id },
        data: {
          firebaseUid,
          email: email ?? user.email,
          name: typeof decoded.name === 'string' ? decoded.name : user.name,
          profilePicture:
            typeof decoded.picture === 'string'
              ? decoded.picture
              : user.profilePicture,
          provider: dto.provider,
          lastActiveAt: new Date(),
        },
      });
    }

    const token = await this.firebaseService.createCustomToken(firebaseUid);
    await this.activityService.logActivity({
      userId: user.id,
      action: 'social_login',
      description: `${dto.provider} social login`,
      metadata: { provider: dto.provider, isNewUser },
    });
    await this.registerPushTokenIfProvided({
      userId: user.id,
      fcmToken: dto.fcmToken,
      pushPlatform: dto.pushPlatform,
    });

    return {
      message: isNewUser
        ? API_MESSAGES.AUTH.SUCCESS.SOCIAL_LOGIN_NEW
        : API_MESSAGES.AUTH.SUCCESS.SOCIAL_LOGIN_EXISTING,
      user: await this.buildUserResponse(user),
      token,
      isNewUser,
    };
  }

  async sendEmailRegistrationOtp(dto: EmailRegisterDto) {
    const email = normalizeEmail(dto.email);
    await this.ensureEmailNotRegistered(email);

    const { otp, expiresIn } = await this.otpService.createOtp(
      email,
      OtpType.EMAIL,
      OtpPurpose.REGISTRATION,
    );
    await this.mailService.sendOtp(email, otp, OtpPurpose.REGISTRATION);

    return {
      message: API_MESSAGES.AUTH.SUCCESS.OTP_SENT_EMAIL,
      email,
      expiresIn,
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    if (dto.method === 'email') {
      if (!dto.email) throw new BadRequestException('Email is required');
      console.log(dto);
      if (dto.purpose === 'register') {
        return this.sendEmailRegistrationOtp({ email: dto.email });
      } else if (dto.purpose === 'forgot_password') {
        return this.sendForgotPasswordOtp({ email: dto.email });
      } else {
        throw new BadRequestException('Invalid purpose for email OTP');
      }
    } else if (dto.method === 'phone') {
      if (!dto.phone) throw new BadRequestException('Phone is required');
      if (dto.purpose === 'register') {
        return this.sendPhoneRegistrationOtp({ phone: dto.phone } as unknown as PhoneRegisterDto);
      } else {
        throw new BadRequestException('Forgot password via phone is not supported');
      }
    }
    throw new BadRequestException('Invalid OTP method');
  }

  async verifyEmailRegistration(dto: VerifyEmailRegisterDto) {
    const email = normalizeEmail(dto.email);
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('Name must be at least 2 characters long');
    }
    await this.ensureEmailNotRegistered(email);
    const otpResult = await this.otpService.verifyOtp(
      email,
      dto.otp,
      OtpType.EMAIL,
      OtpPurpose.REGISTRATION,
    );
    this.otpService.assertValidOtpResult(otpResult);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const firebaseUser = await this.firebaseService.createUser({
      email,
      password: dto.password,
    });

    try {
      const username = await this.generateUniqueUsername(email);
      const user = await this.prismaService.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username,
            email,
            passwordHash,
            firebaseUid: firebaseUser.uid,
            provider: AuthProvider.EMAIL,
            isProfileComplete: false,
            lastActiveAt: new Date(),
            name,
            currentSubscriptionPlanId: PLAN_IDS.FREE,
          },
        });

        await tx.otpRecord.update({
          where: { id: otpResult.otpRecord!.id },
          data: { isUsed: true },
        });

        return createdUser;
      });
      const token = await this.firebaseService.createCustomToken(
        firebaseUser.uid,
      );
      await this.activityService.logActivity({
        userId: user.id,
        action: 'email_registration',
        description: 'Email registration completed',
      });
      await this.registerPushTokenIfProvided({
        userId: user.id,
        fcmToken: dto.fcmToken,
        pushPlatform: dto.pushPlatform,
      });
      await this.mailService.sendWelcomeEmail(email, user.name ?? undefined);

      return {
        message: API_MESSAGES.AUTH.SUCCESS.REGISTRATION_SUCCESS,
        user: await this.buildUserResponse(user),
        token,
      };
    } catch (error) {
      await this.firebaseService.deleteUser(firebaseUser.uid);
      throw error;
    }
  }

  async sendForgotPasswordOtp(dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prismaService.user.findFirst({
      where: { email, isDeleted: false, isActive: true },
    });

    if (!user) {
      throw new NotFoundException(API_MESSAGES.AUTH.ERROR.EMAIL_NOT_FOUND);
    }
    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException(
        API_MESSAGES.AUTH.ERROR.PASSWORD_RESET_EMAIL_ONLY,
      );
    }

    const { otp, expiresIn } = await this.otpService.createOtp(
      email,
      OtpType.EMAIL,
      OtpPurpose.FORGOT_PASSWORD,
    );
    await this.mailService.sendOtp(email, otp, OtpPurpose.FORGOT_PASSWORD);
    await this.activityService.logActivity({
      userId: user.id,
      action: 'forgot_password_request',
      description: 'Requested password reset OTP',
    });

    return {
      message: API_MESSAGES.AUTH.SUCCESS.OTP_SENT_EMAIL,
      email,
      expiresIn,
    };
  }

  async verifyForgotPasswordOtp(dto: VerifyForgotPasswordDto) {
    const result = await this.otpService.verifyOtp(
      normalizeEmail(dto.email),
      dto.otp,
      OtpType.EMAIL,
      OtpPurpose.FORGOT_PASSWORD,
    );
    this.otpService.assertValidOtpResult(result);
    return {
      message: API_MESSAGES.AUTH.SUCCESS.OTP_VERIFIED,
      email: normalizeEmail(dto.email),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = normalizeEmail(dto.email);
    const otpResult = await this.otpService.verifyOtp(
      email,
      dto.otp,
      OtpType.EMAIL,
      OtpPurpose.FORGOT_PASSWORD,
    );
    this.otpService.assertValidOtpResult(otpResult);

    const user = await this.prismaService.user.findFirst({
      where: { email, isDeleted: false, isActive: true },
    });
    if (!user?.firebaseUid) {
      throw new NotFoundException(API_MESSAGES.AUTH.ERROR.USER_NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prismaService.otpRecord.update({
        where: { id: otpResult.otpRecord!.id },
        data: { isUsed: true },
      }),
    ]);
    await this.firebaseService.updatePassword(
      user.firebaseUid,
      dto.newPassword,
    );
    await this.activityService.logActivity({
      userId: user.id,
      action: 'password_reset',
      description: 'Password reset completed',
    });

    return { message: API_MESSAGES.AUTH.SUCCESS.PASSWORD_RESET_SUCCESS };
  }

  async sendPhoneRegistrationOtp(dto: PhoneRegisterDto) {
    const phone = normalizePhone(dto.phone);
    await this.ensurePhoneNotRegistered(phone);

    const { otp, expiresIn } = await this.otpService.createOtp(
      phone,
      OtpType.PHONE,
      OtpPurpose.REGISTRATION,
    );
    await this.smsService.sendOtp(phone, otp);

    return {
      message: API_MESSAGES.AUTH.SUCCESS.OTP_SENT_PHONE,
      phone,
      expiresIn,
    };
  }

  async verifyPhoneRegistration(dto: VerifyPhoneRegisterDto) {
    const phone = normalizePhone(dto.phone);
    await this.ensurePhoneNotRegistered(phone);
    const otpResult = await this.otpService.verifyOtp(
      phone,
      dto.otp,
      OtpType.PHONE,
      OtpPurpose.REGISTRATION,
    );
    this.otpService.assertValidOtpResult(otpResult);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const firebaseUser = await this.firebaseService.createUser({
      phoneNumber: phone,
      password: dto.password,
    });

    try {
      const username = await this.generateUniqueUsername(phone);
      const user = await this.prismaService.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username,
            phone,
            passwordHash,
            firebaseUid: firebaseUser.uid,
            provider: AuthProvider.PHONE,
            isProfileComplete: false,
            lastActiveAt: new Date(),
            currentSubscriptionPlanId: PLAN_IDS.FREE,
          },
        });

        await tx.otpRecord.update({
          where: { id: otpResult.otpRecord!.id },
          data: { isUsed: true },
        });

        return createdUser;
      });

      const token = await this.firebaseService.createCustomToken(
        firebaseUser.uid,
      );
      await this.activityService.logActivity({
        userId: user.id,
        action: 'phone_registration',
        description: 'Phone registration completed',
      });
      await this.registerPushTokenIfProvided({
        userId: user.id,
        fcmToken: dto.fcmToken,
        pushPlatform: dto.pushPlatform,
      });

      return {
        message: API_MESSAGES.AUTH.SUCCESS.REGISTRATION_SUCCESS,
        user: await this.buildUserResponse(user),
        token,
      };
    } catch (error) {
      await this.firebaseService.deleteUser(firebaseUser.uid);
      throw error;
    }
  }

  async login(dto: LoginPasswordDto) {
    const identifier = dto.identifier.includes('@')
      ? normalizeEmail(dto.identifier)
      : normalizePhone(dto.identifier);
    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
        isDeleted: false,
        isActive: true,
      },
    });

    if (!user?.passwordHash || !user.firebaseUid) {
      throw new UnauthorizedException(
        API_MESSAGES.AUTH.ERROR.INVALID_CREDENTIALS,
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      this.logger.warn(`Failed login attempt for ${identifier}`);
      throw new UnauthorizedException(
        API_MESSAGES.AUTH.ERROR.INVALID_CREDENTIALS,
      );
    }

    const updatedUser = await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    const token = await this.firebaseService.createCustomToken(
      updatedUser.firebaseUid!,
    );
    await this.activityService.logActivity({
      userId: updatedUser.id,
      action: 'password_login',
      description: 'Password login successful',
    });
    await this.registerPushTokenIfProvided({
      userId: updatedUser.id,
      fcmToken: dto.fcmToken,
      pushPlatform: dto.pushPlatform,
    });

    return {
      message: API_MESSAGES.AUTH.SUCCESS.LOGIN_SUCCESS,
      user: await this.buildUserResponse(updatedUser),
      token,
    };
  }

  async logout(user: User) {
    await this.activityService.logActivity({
      userId: user.id,
      action: 'logout',
      description: 'User logged out',
    });
    return { message: API_MESSAGES.AUTH.SUCCESS.LOGOUT_SUCCESS };
  }

  async registerFcmToken(userId: string, dto: RegisterPushTokenDto) {
    return this.notificationService.registerPushToken(userId, dto);
  }

  private async ensureEmailNotRegistered(email: string): Promise<void> {
    const existingUser = await this.prismaService.user.findFirst({
      where: { email, isDeleted: false },
    });
    if (existingUser) {
      throw new BadRequestException(
        API_MESSAGES.AUTH.ERROR.EMAIL_ALREADY_REGISTERED,
      );
    }
  }

  private async ensurePhoneNotRegistered(phone: string): Promise<void> {
    const existingUser = await this.prismaService.user.findFirst({
      where: { phone, isDeleted: false },
    });
    if (existingUser) {
      throw new BadRequestException(
        API_MESSAGES.AUTH.ERROR.PHONE_ALREADY_REGISTERED,
      );
    }
  }

  private async generateUniqueUsername(seed?: string): Promise<string> {
    const normalizedSeed = (seed ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/^[_-]+|[_-]+$/g, '');

    const base = (normalizedSeed || 'user').slice(0, 24);

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
}
