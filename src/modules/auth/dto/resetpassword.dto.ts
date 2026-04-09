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

export class ResetPasswordDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email: string;

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
  newPassword: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @MatchField('newPassword', {
    message: 'Confirm password does not match new password',
  })
  confirmPassword: string;
}
