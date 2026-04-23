import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import {
  normalizeEmail,
  trimString,
} from '../../../common/utils/sanitizers.util';
import { MatchField } from '../../../common/validators/match-field.decorator';
import { IsStrongPassword } from '../../../common/validators/password.decorator';

export class VerifyEmailRegisterDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: '123456' })
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @IsStrongPassword()
  password: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @MatchField('password', {
    message: 'Confirm password does not match password',
  })
  confirmPassword: string;
}
