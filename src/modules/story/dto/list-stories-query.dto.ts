import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListStoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter favorite stories only',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  favorite?: boolean = false;

  @ApiPropertyOptional({
    description: 'Sort by newest first',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  recent?: boolean = false;
}