import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class EnqueueJobDto {
  @ApiProperty({ enum: JobType })
  @IsEnum(JobType)
  type: JobType;

  @ApiProperty()
  @IsString()
  queue: string;

  @ApiProperty()
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ minimum: 0, maximum: 10, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  priority?: number = 0;
}
