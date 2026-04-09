import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  sanitizeUsername,
  trimString,
} from '../../../common/utils/sanitizers.util';

export class SetupProfileDto {
  @ApiProperty({ example: 'jane_doe' })
  @Transform(({ value }) => sanitizeUsername(String(value)))
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, underscores, and dashes',
  })
  username: string;

  @ApiProperty({ example: 'Jane Doe' })
  @Transform(({ value }) => trimString(String(value)))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  profilePicture?: unknown;
}
