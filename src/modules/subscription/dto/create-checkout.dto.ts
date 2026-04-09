import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Stripe Price ID to subscribe to' })
  @IsString()
  priceId: string;
}
