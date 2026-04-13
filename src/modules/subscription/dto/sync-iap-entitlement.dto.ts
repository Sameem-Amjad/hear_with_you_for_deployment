import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SyncIapEntitlementDto {
  @ApiPropertyOptional({ description: 'Optional user id for admin-triggered sync' })
  @IsOptional()
  @IsString()
  userId?: string;
}
