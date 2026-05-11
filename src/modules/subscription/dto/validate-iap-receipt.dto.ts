import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum IapPlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export class SaveSubscriptionDto {
  @ApiPropertyOptional({
    enum: IapPlatform,
    description: 'Platform the purchase was made on',
  })
  @IsOptional()
  @IsEnum(IapPlatform)
  platform?: IapPlatform;

  @ApiPropertyOptional({
    description:
      'Store product ID received from Apple/Google after purchase. ' +
      'Omit or leave empty when no active subscription (triggers downgrade to free plan).',
  })
  @IsOptional()
  @IsString()
  productId?: string;
}
