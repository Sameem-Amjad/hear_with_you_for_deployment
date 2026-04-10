import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { EmailRegisterDto } from './dto/emailregister.dto';
import { ForgotPasswordDto } from './dto/forgotpassword.dto';
import { LoginPasswordDto } from './dto/loginpassword.dto';
import { PhoneRegisterDto } from './dto/phoneregister.dto';
import { ResetPasswordDto } from './dto/resetpassword.dto';
import { SocialLoginDto } from './dto/sociallogin.dto';
import { VerifyEmailRegisterDto } from './dto/verifyemailregister.dto';
import { VerifyForgotPasswordDto } from './dto/verifyforgotpassword.dto';
import { VerifyPhoneRegisterDto } from './dto/verifyphoneregister.dto';
import { ResendOtpDto } from './dto/resendotp.dto';
import { AuthService } from './auth.service';
import { API_PATHS } from '../../common/constants/api.paths';
import { SWAGGER_META } from '../../common/constants/swagger.meta';

@ApiTags(SWAGGER_META.TAGS.AUTH)
@Controller(API_PATHS.AUTH.ROOT)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post(API_PATHS.AUTH.SOCIAL_LOGIN)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.SOCIAL_LOGIN.SUMMARY,
    description: SWAGGER_META.AUTH.SOCIAL_LOGIN.DESCRIPTION,
  })
  @ApiResponse({ status: 200, description: 'OK' })
  socialLogin(@Body() dto: SocialLoginDto) {
    return this.authService.socialLogin(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.EMAIL.REGISTER)
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.EMAIL_REGISTER.SUMMARY,
    description: SWAGGER_META.AUTH.EMAIL_REGISTER.DESCRIPTION,
  })
  sendEmailRegistrationOtp(@Body() dto: EmailRegisterDto) {
    return this.authService.sendEmailRegistrationOtp(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.EMAIL.VERIFY_REGISTER)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.EMAIL_VERIFY_REGISTER.SUMMARY,
    description: SWAGGER_META.AUTH.EMAIL_VERIFY_REGISTER.DESCRIPTION,
  })
  verifyEmailRegistration(@Body() dto: VerifyEmailRegisterDto) {
    return this.authService.verifyEmailRegistration(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.PASSWORD.FORGOT)
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.PASSWORD_FORGOT.SUMMARY,
    description: SWAGGER_META.AUTH.PASSWORD_FORGOT.DESCRIPTION,
  })
  sendForgotPasswordOtp(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendForgotPasswordOtp(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.PASSWORD.VERIFY_OTP)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.PASSWORD_VERIFY_OTP.SUMMARY,
    description: SWAGGER_META.AUTH.PASSWORD_VERIFY_OTP.DESCRIPTION,
  })
  verifyForgotPasswordOtp(@Body() dto: VerifyForgotPasswordDto) {
    return this.authService.verifyForgotPasswordOtp(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.OTP_RESEND)
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.RESEND_OTP.SUMMARY,
    description: SWAGGER_META.AUTH.RESEND_OTP.DESCRIPTION,
  })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.PASSWORD.RESET)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.PASSWORD_RESET.SUMMARY,
    description: SWAGGER_META.AUTH.PASSWORD_RESET.DESCRIPTION,
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.PHONE.REGISTER)
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.PHONE_REGISTER.SUMMARY,
    description: SWAGGER_META.AUTH.PHONE_REGISTER.DESCRIPTION,
  })
  sendPhoneRegistrationOtp(@Body() dto: PhoneRegisterDto) {
    return this.authService.sendPhoneRegistrationOtp(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.PHONE.VERIFY_REGISTER)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.PHONE_VERIFY_REGISTER.SUMMARY,
    description: SWAGGER_META.AUTH.PHONE_VERIFY_REGISTER.DESCRIPTION,
  })
  verifyPhoneRegistration(@Body() dto: VerifyPhoneRegisterDto) {
    return this.authService.verifyPhoneRegistration(dto);
  }

  @Public()
  @Post(API_PATHS.AUTH.PASSWORD.LOGIN)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @ApiOperation({
    summary: SWAGGER_META.AUTH.PASSWORD_LOGIN.SUMMARY,
    description: SWAGGER_META.AUTH.PASSWORD_LOGIN.DESCRIPTION,
  })
  login(@Body() dto: LoginPasswordDto) {
    return this.authService.login(dto);
  }

  @Post(API_PATHS.AUTH.LOGOUT)
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebaseauth')
  @ApiOperation({
    summary: SWAGGER_META.AUTH.LOGOUT.SUMMARY,
    description: SWAGGER_META.AUTH.LOGOUT.DESCRIPTION,
  })
  logout(@CurrentUser() user: never) {
    return this.authService.logout(user);
  }
}
