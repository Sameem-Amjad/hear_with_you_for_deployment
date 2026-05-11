import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ description: 'Plan display name, e.g. "Family Plan"' })
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Price shown to the user', example: 9.99 })
  @IsNumber()
  @Min(0)
  displayPrice: number;

  @ApiPropertyOptional({ enum: ['none', 'week', 'month', 'year'], default: 'month' })
  @IsOptional()
  @IsString()
  billingPeriod?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  storiesPerMonth?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  voiceProfiles?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  audioGenerationsPerMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  storeProductIds?: { ios?: string; android?: string };

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
