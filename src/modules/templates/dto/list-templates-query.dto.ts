import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListTemplatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by template name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
