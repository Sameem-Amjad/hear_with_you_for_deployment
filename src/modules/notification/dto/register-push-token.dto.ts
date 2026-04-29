import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @Length(20, 4096)
  token: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web', 'unknown'])
  platform?: 'ios' | 'android' | 'web' | 'unknown';
}