/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Get,
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
import { SyncIapEntitlementDto } from './dto/sync-iap-entitlement.dto';
import { ValidateIapReceiptDto } from './dto/validate-iap-receipt.dto';
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

  @Get('plans')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get subscription plans (IAP metadata)' })
  plans() {
    return this.subscriptionService.getPlans();
  }

  @Get('me')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Get current user subscription and usage' })
  me(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.getMySubscription(user.id);
  }

  @Post('iap/validate')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Record IAP purchase payload and sync entitlement' })
  validateIap(
    @CurrentUser() user: { id: string },
    @Body() dto: ValidateIapReceiptDto,
  ) {
    return this.subscriptionService.validateIapReceipt(user.id, dto);
  }

  @Post('iap/record')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Record IAP purchase payload and sync entitlement' })
  recordIap(
    @CurrentUser() user: { id: string },
    @Body() dto: ValidateIapReceiptDto,
  ) {
    return this.subscriptionService.validateIapReceipt(user.id, dto);
  }

  @Post('iap/sync')
  @ApiBearerAuth('firebaseauth')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Sync IAP entitlement from current user state' })
  syncIap(
    @CurrentUser() user: { id: string },
    @Body() dto: SyncIapEntitlementDto,
  ) {
    return this.subscriptionService.syncIapEntitlement(dto.userId ?? user.id);
  }

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
