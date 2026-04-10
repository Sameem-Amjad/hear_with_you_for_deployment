import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OtpMethod {
  EMAIL = 'email',
  PHONE = 'phone',
}

export enum ResendOtpPurpose {
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot_password',
}

export class ResendOtpDto {
  @ApiProperty({ enum: OtpMethod, example: 'email' })
  @IsEnum(OtpMethod)
  @IsOptional()
  method: OtpMethod;

  @ApiProperty({ enum: ResendOtpPurpose, example: 'register' })
  @IsEnum(ResendOtpPurpose)
  @IsOptional()
  purpose: ResendOtpPurpose;

  @ApiProperty({ required: false, example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}
