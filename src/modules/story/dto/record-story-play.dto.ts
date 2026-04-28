import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class RecordStoryPlayDto {
  @ApiPropertyOptional({
    description: 'Playback position in seconds',
    default: false,
  })
  @IsOptional()
  @IsNumber()
  playbackPositionSeconds?: number;

  @ApiPropertyOptional({
    description: 'Completion rate in percentage',
    default: null,
  })
  @IsOptional()
  @IsNumber()
  completionRate?: number;

  @ApiPropertyOptional({
    description: 'Whether the story was played to completion',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  wasCompleted?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;
}
