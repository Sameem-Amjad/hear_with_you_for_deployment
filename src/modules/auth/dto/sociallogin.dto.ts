import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '@prisma/client';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
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
}
