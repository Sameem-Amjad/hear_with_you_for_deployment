import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { trimString } from '../../../common/utils/sanitizers.util';

export class SocialLoginDto {
  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({ enum: [AuthProvider.GOOGLE, AuthProvider.APPLE] })
  @IsIn([AuthProvider.GOOGLE, AuthProvider.APPLE])
  provider: AuthProvider;

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
