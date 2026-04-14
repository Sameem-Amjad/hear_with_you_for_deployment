import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AdminTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Plan code filter' })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ description: 'succeeded | failed | refunded | pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}
