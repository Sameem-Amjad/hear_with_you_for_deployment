import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import {
  normalizePhone,
  trimString,
} from '../../../common/utils/sanitizers.util';
import { MatchField } from '../../../common/validators/match-field.decorator';
import { IsStrongPassword } from '../../../common/validators/password.decorator';
import { IsE164Phone } from '../../../common/validators/phone.decorator';

export class VerifyPhoneRegisterDto {
  @ApiProperty({ example: '+1234567890' })
  @Transform(({ value }) => normalizePhone(String(value)))
  @IsString()
  @IsE164Phone()
  phone: string;

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

  @ApiProperty({ required: false, description: 'FCM registration token' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? trimString(value) : value,
  )
  @IsString()
  @Length(20, 4096)
  fcmToken?: string;

  @ApiProperty({
    required: false,
    enum: ['ios', 'android', 'web', 'unknown'],
    description: 'Device platform for the FCM token',
  })
  @IsOptional()
  @IsIn(['ios', 'android', 'web', 'unknown'])
  pushPlatform?: 'ios' | 'android' | 'web' | 'unknown';
}
