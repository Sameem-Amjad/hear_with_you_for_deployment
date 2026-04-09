import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/sanitizers.util';

export class EmailRegisterDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email: string;

  // @ApiProperty()
  // @Transform(({ value }) => trimString(String(value)))
  // @IsString()
  // @IsNotEmpty()
  // @MinLength(8)
  // @IsStrongPassword()
  // password: string;

  // @ApiProperty()
  // @Transform(({ value }) => trimString(String(value)))
  // @IsString()
  // @MatchField('password', { message: 'Confirm password does not match password' })
  // confirmPassword: string;
}
