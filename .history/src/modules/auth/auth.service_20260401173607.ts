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
import { OtpService } from '../otp/otp.service';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';
import { ActivityService } from '../activity/activity.service';
import { UserResponseDto } from '../user/dto/userresponse.dto';
import { SocialLoginDto } from './dto/sociallogin.dto';
import { EmailRegisterDto } from './dto/emailregister.dto';
import { VerifyEmailRegisterDto } from './dto/verifyemailregister.dto';
import { ForgotPasswordDto } from './dto/forgotpassword.dto';
import { VerifyForgotPasswordDto } from './dto/verifyforgotpassword.dto';
import { ResetPasswordDto } from './dto/resetpassword.dto';
import { PhoneRegisterDto } from './dto/phoneregister.dto';
import { VerifyPhoneRegisterDto } from './dto/verifyphoneregister.dto';
import { LoginPasswordDto } from './dto/loginpassword.dto';
import { normalizeEmail, normalizePhone } from '../../common/utils/sanitizers.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
    private readonly activityService: ActivityService,
  ) {}

  async socialLogin(dto: SocialLoginDto) {
    const decoded = await this.firebaseService.verifyIdToken(dto.idToken);
    const email = decoded.email ? normalizeEmail(decoded.email) : undefined;
    const firebaseUid = decoded.uid;

    let user = await this.prismaService.user.findFirst({
      where: {
        OR: [
          { firebaseUid },
          ...(email ? [{ email }] : []),
        ],
        isDeleted: false,
      },
    });

    let isNewUser = false;
    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          firebaseUid,
          email,
          name: typeof decoded.name === 'string' ? decoded.name : undefined,
          profilePicture:
            typeof decoded.picture === 'string' ? decoded.picture : undefined,
          provider: dto.provider,
          isProfileComplete: false,
          lastActiveAt: new Date(),
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

    return {
      message: isNewUser ? 'Social account created successfully' : 'Social login successful',
      user: UserResponseDto.fromUser(user),
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
      message: 'OTP sent to email',
      email,
      expiresIn,
    };
  }

  async verifyEmailRegistration(dto: VerifyEmailRegisterDto) {
    const email = normalizeEmail(dto.email);
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
      const user = await this.prismaService.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            firebaseUid: firebaseUser.uid,
            provider: AuthProvider.EMAIL,
            isProfileComplete: false,
            lastActiveAt: new Date(),
          },
        });

        await tx.otpRecord.update({
          where: { id: otpResult.otpRecord!.id },
          data: { isUsed: true },
        });

        return createdUser;
      });
      console.log("firebase user creted" , firebaseUser)
      const token = await this.firebaseService.createCustomToken(firebaseUser.uid);
      await this.activityService.logActivity({
        userId: user.id,
        action: 'email_registration',
        description: 'Email registration completed',
      });
      await this.mailService.sendWelcomeEmail(email, user.name ?? undefined);

      return {
        message: 'Registration successful',
        user: UserResponseDto.fromUser(user),
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
      throw new NotFoundException('Email not found');
    }
    if (user.provider !== AuthProvider.EMAIL) {
      throw new BadRequestException('Password reset is only available for email accounts');
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
      message: 'OTP sent to email',
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
      message: 'OTP verified',
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
      throw new NotFoundException('User not found');
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
    await this.firebaseService.updatePassword(user.firebaseUid, dto.newPassword);
    await this.activityService.logActivity({
      userId: user.id,
      action: 'password_reset',
      description: 'Password reset completed',
    });

    return { message: 'Password reset successful' };
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
      message: 'OTP sent to phone',
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
      const user = await this.prismaService.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            phone,
            passwordHash,
            firebaseUid: firebaseUser.uid,
            provider: AuthProvider.PHONE,
            isProfileComplete: false,
            lastActiveAt: new Date(),
          },
        });

        await tx.otpRecord.update({
          where: { id: otpResult.otpRecord!.id },
          data: { isUsed: true },
        });

        return createdUser;
      });

      const token = await this.firebaseService.createCustomToken(firebaseUser.uid);
      await this.activityService.logActivity({
        userId: user.id,
        action: 'phone_registration',
        description: 'Phone registration completed',
      });

      return {
        message: 'Registration successful',
        user: UserResponseDto.fromUser(user),
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
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      this.logger.warn(`Failed login attempt for ${identifier}`);
      throw new UnauthorizedException('Invalid credentials');
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

    return {
      message: 'Login successful',
      user: UserResponseDto.fromUser(updatedUser),
      token,
    };
  }

  async logout(user: User) {
    await this.activityService.logActivity({
      userId: user.id,
      action: 'logout',
      description: 'User logged out',
    });
    return { message: 'Logged out successfully' };
  }

  private async ensureEmailNotRegistered(email: string): Promise<void> {
    const existingUser = await this.prismaService.user.findFirst({
      where: { email, isDeleted: false },
    });
    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }
  }

  private async ensurePhoneNotRegistered(phone: string): Promise<void> {
    const existingUser = await this.prismaService.user.findFirst({
      where: { phone, isDeleted: false },
    });
    if (existingUser) {
      throw new BadRequestException('Phone is already registered');
    }
  }
}
