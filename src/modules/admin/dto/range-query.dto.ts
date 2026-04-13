import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RangeQueryDto {
  @ApiPropertyOptional({ example: '30d' })
  @IsOptional()
  @IsString()
  range?: string;
}
