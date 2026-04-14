import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Plan code filter' })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ description: 'active | inactive' })
  @IsOptional()
  @IsString()
  status?: string;
}
