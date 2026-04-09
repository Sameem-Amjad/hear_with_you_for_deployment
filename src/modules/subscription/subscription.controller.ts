/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  @Post('checkout')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  checkout(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.subscriptionService.createCheckoutSession(user.id, dto.priceId);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    const webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!signature) throw new Error('Missing Stripe signature');

    const payload = req.rawBody;
    if (!payload) {
      throw new Error('Missing raw body for webhook verification');
    }

    const event = await this.stripeService.constructEvent({
      payload,
      signature,
      webhookSecret,
    });

    return this.subscriptionService.handleWebhook(event);
  }
}
