import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import {
  normalizeEmail,
  trimString,
} from '../../../common/utils/sanitizers.util';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email!: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  password!: string;
}
