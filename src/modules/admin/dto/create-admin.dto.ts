import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  normalizeEmail,
  trimString,
} from '../../../common/utils/sanitizers.util';
import { MatchField } from '../../../common/validators/match-field.decorator';
import { IsStrongPassword } from '../../../common/validators/password.decorator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Admin User' })
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email: string;

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

  @ApiPropertyOptional({ description: 'Optional public profile image URL' })
  @IsOptional()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  profilePicture?: string;
}
