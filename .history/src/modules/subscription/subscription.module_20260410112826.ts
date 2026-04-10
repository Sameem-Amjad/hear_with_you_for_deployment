import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, StripeService,ProviderCredentialsService],
})
export class SubscriptionModule {}
