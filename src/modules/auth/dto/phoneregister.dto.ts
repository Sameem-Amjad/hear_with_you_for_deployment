import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import {
  normalizePhone,
  trimString,
} from '../../../common/utils/sanitizers.util';
import { MatchField } from '../../../common/validators/match-field.decorator';
import { IsStrongPassword } from '../../../common/validators/password.decorator';
import { IsE164Phone } from '../../../common/validators/phone.decorator';

export class PhoneRegisterDto {
  @ApiProperty({ example: '+1234567890' })
  @Transform(({ value }) => normalizePhone(String(value)))
  @IsString()
  @IsE164Phone()
  phone: string;

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
