import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import {
  normalizeEmail,
  trimString,
} from '../../../common/utils/sanitizers.util';

export class VerifyForgotPasswordDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @Length(6, 6)
  otp: string;
}
