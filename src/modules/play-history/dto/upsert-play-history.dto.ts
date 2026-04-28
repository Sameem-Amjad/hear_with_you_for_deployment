import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertPlayHistoryDto {
  @ApiProperty()
  @IsString()
  storyId: string;

  @ApiPropertyOptional({ description: 'Playback position in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  playbackPositionSeconds?: number;

  @ApiPropertyOptional({ description: 'Completion rate in percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  completionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  wasCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;
}
