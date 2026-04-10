import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../../common/utils/sanitizers.util';

export class SetupProfileDto {
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
