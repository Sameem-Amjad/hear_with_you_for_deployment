import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { trimString } from '../../../common/utils/sanitizers.util';

export class LoginPasswordDto {
  @ApiProperty({ example: 'user@example.com or +1234567890' })
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty()
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  password: string;
}
