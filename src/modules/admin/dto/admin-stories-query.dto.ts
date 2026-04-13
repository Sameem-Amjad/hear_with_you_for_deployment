import { ApiPropertyOptional } from '@nestjs/swagger';
import { StoryTheme } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AdminStoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: StoryTheme })
  @IsOptional()
  @IsEnum(StoryTheme)
  theme?: StoryTheme;

  @ApiPropertyOptional({ description: 'ISO date' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date' })
  @IsOptional()
  @IsString()
  to?: string;
}
