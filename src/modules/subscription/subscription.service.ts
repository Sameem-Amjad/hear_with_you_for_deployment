/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  async createCheckoutSession(userId: string, priceId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new BadRequestException('User not found');

    const successUrl =
      this.configService.getOrThrow<string>('STRIPE_SUCCESS_URL');
    const cancelUrl =
      this.configService.getOrThrow<string>('STRIPE_CANCEL_URL');

    const session = await this.stripeService.createCheckoutSession({
      customerEmail: user.email,
      customerId: user.customerId,
      priceId,
      successUrl,
      cancelUrl,
      metadata: { userId },
    });

    return {
      message: 'Checkout session created',
      url: session.url,
      sessionId: session.id,
    };
  }

  async handleWebhook(event: any) {
    // idempotency stored in StripeWebhookEvent table
    const existing = await this.prismaService.stripeWebhookEvent.findUnique({
      where: { eventId: event.id },
    });
    if (existing?.status === 'PROCESSED') {
      return { ok: true };
    }

    await this.prismaService.stripeWebhookEvent.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        type: event.type,
        payload: event as unknown as object,
        status: 'PROCESSING',
      },
      update: {
        status: 'PROCESSING',
        payload: event as unknown as object,
      },
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.onSubscriptionChanged(event.data.object);
          break;
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          // payment tracking can be expanded
          break;
        default:
          break;
      }

      await this.prismaService.stripeWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: 'PROCESSED', processedAt: new Date(), error: null },
      });

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook handling failed: ${message}`);
      await this.prismaService.stripeWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: 'FAILED', processedAt: new Date(), error: message },
      });
      throw err;
    }
  }

  private async onCheckoutCompleted(session: any) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    const customerId =
      typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : null;

    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        customerId: customerId ?? undefined,
        subscriptionId: subscriptionId ?? undefined,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionStartDate: new Date(),
      },
    });
  }

  private async onSubscriptionChanged(subscription: any) {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : null;
    if (!customerId) return;

    const user = await this.prismaService.user.findFirst({
      where: { customerId },
    });
    if (!user) return;

    const status =
      subscription.status === 'active'
        ? SubscriptionStatus.ACTIVE
        : subscription.status === 'trialing'
          ? SubscriptionStatus.TRIALING
          : subscription.status === 'past_due'
            ? SubscriptionStatus.PAST_DUE
            : subscription.status === 'canceled'
              ? SubscriptionStatus.CANCELED
              : SubscriptionStatus.INACTIVE;

    // Tier mapping is app-specific; default to PREMIUM when active unless admin sets otherwise.
    const tier =
      status === SubscriptionStatus.ACTIVE
        ? SubscriptionTier.PREMIUM
        : SubscriptionTier.FREE;

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: status,
        subscriptionTier: tier,
        subscriptionEndDate: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : undefined,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      },
    });
  }
}
