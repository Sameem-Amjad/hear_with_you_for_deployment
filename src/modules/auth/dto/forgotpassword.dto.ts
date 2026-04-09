import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/sanitizers.util';

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeEmail(String(value)))
  @IsEmail()
  email: string;
}
