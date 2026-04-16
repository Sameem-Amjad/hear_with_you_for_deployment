import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export enum IapPlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export class ValidateIapReceiptDto {
  @ApiProperty({ enum: IapPlatform })
  @IsEnum(IapPlatform)
  platform?: IapPlatform;

  @ApiPropertyOptional({
    description: 'Opaque receipt/token payload from mobile SDK (stored as metadata)',
  })
  @IsOptional()
  @IsString()
  receiptData?: string;

  @ApiProperty({ description: 'Store product id' })
  @IsString()
  productId?: string;

  @ApiProperty({ description: 'Store transaction id' })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Google Play purchase token' })
  @IsOptional()
  @IsString()
  purchaseToken?: string;

  @ApiPropertyOptional({ description: 'Backend plan id from /subscription/plans' })
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'ISO purchase date from mobile transaction' })
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: 'ISO expiry date from mobile transaction' })
  @IsOptional()
  @IsString()
  expiresDate?: string;

  @ApiPropertyOptional({ description: 'Amount charged in app store' })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Currency code from mobile transaction', example: 'usd' })
  @IsOptional()
  @IsString()
  currency?: string;
}
