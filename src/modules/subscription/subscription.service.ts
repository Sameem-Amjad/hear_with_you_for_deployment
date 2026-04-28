/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import {
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
  SubscriptionTier,
} from '@prisma/client';
import { IapPlatform, ValidateIapReceiptDto } from './dto/validate-iap-receipt.dto';

type PlanSettings = {
  id: string;
  code: string;
  displayName: string;
  displayPrice: number;
  currency: string;
  billingPeriod: 'none' | 'month' | 'year';
  storiesPerMonth: number;
  voiceProfiles: number;
  audioGenerationsPerMonth: number;
  storeProductIdIos: string;
  storeProductIdAndroid: string;
  isActive: boolean;
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  private getFallbackPlanSettings(): Record<string, PlanSettings> {
    return {
      FREE: {
        id: 'plan_free',
        code: 'FREE',
        displayName: 'Basic',
        displayPrice: 0,
        currency: 'USD',
        billingPeriod: 'none',
        storiesPerMonth: 5,
        voiceProfiles: 1,
        audioGenerationsPerMonth: 5,
        storeProductIdIos: '',
        storeProductIdAndroid: '',
        isActive: true,
      },
      PREMIUM: {
        id: 'plan_premium',
        code: 'PREMIUM',
        displayName: 'Premium',
        displayPrice: Number(this.configService.get('IAP_PREMIUM_PRICE') ?? 9.99),
        currency: 'USD',
        billingPeriod: 'month',
        storiesPerMonth: 50,
        voiceProfiles: 3,
        audioGenerationsPerMonth: 50,
        storeProductIdIos: '',
        storeProductIdAndroid: '',
        isActive: true,
      },
      PLATINUM: {
        id: 'plan_platinum',
        code: 'PLATINUM',
        displayName: 'Platinum',
        displayPrice: Number(
          this.configService.get('IAP_PLATINUM_PRICE') ?? 19.99,
        ),
        currency: 'USD',
        billingPeriod: 'month',
        storiesPerMonth: 1_000_000,
        voiceProfiles: 10,
        audioGenerationsPerMonth: 1_000_000,
        storeProductIdIos: '',
        storeProductIdAndroid: '',
        isActive: true,
      },
      ENTERPRISE: {
        id: 'plan_enterprise',
        code: 'ENTERPRISE',
        displayName: 'Enterprise',
        displayPrice: Number(
          this.configService.get('IAP_ENTERPRISE_PRICE') ?? 49.99,
        ),
        currency: 'USD',
        billingPeriod: 'month',
        storiesPerMonth: 1_000_000,
        voiceProfiles: 10,
        audioGenerationsPerMonth: 1_000_000,
        storeProductIdIos: '',
        storeProductIdAndroid: '',
        isActive: false,
      },
    };
  }

  constructor(
    private readonly prismaService: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  private asPositiveInt(value: unknown): number | undefined {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return undefined;
    const int = Math.floor(num);
    return int > 0 ? int : undefined;
  }

  private asNonNegativeNumber(value: unknown): number | undefined {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return undefined;
    return num >= 0 ? num : undefined;
  }

  private asNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private asBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  private async ensureDefaultPlansSeeded(): Promise<void> {
    const defaults = this.getFallbackPlanSettings();

    await this.prismaService.$transaction(
      Object.values(defaults).map((plan) =>
        this.prismaService.subscriptionPlan.upsert({
          where: { code: plan.code as any },
          create: {
            id: plan.id,
            code: plan.code as any,
            displayName: plan.displayName,
            displayPrice: plan.displayPrice,
            currency: plan.currency,
            billingPeriod: plan.billingPeriod,
            storiesPerMonth: plan.storiesPerMonth,
            voiceProfiles: plan.voiceProfiles,
            storeProductIdIos: plan.storeProductIdIos,
            storeProductIdAndroid: plan.storeProductIdAndroid,
            isActive: plan.isActive,
          },
          update: {},
        }),
      ),
    );
  }

  private async getResolvedPlanSettings(): Promise<
    Record<string, PlanSettings>
  > {
    const defaults = this.getFallbackPlanSettings();

    try {
      await this.ensureDefaultPlansSeeded();

      const plansFromDb = await this.prismaService.subscriptionPlan.findMany();
      const resolved = new Map<string, PlanSettings>();

      for (const plan of Object.values(defaults)) {
        resolved.set(plan.code, plan);
      }

      for (const raw of plansFromDb) {
        const planRecord = raw as typeof raw & {
          audioGenerationsPerMonth?: number;
        };
        resolved.set(raw.code, {
          id: this.asNonEmptyString(raw.id) ?? `plan_${raw.code.toLowerCase()}`,
          code: this.asNonEmptyString(raw.code) ?? raw.code,
          displayName: this.asNonEmptyString(raw.displayName) ?? raw.code,
          displayPrice:
            this.asNonNegativeNumber(raw.displayPrice) ?? 0,
          currency: (this.asNonEmptyString(raw.currency) ?? 'USD').toUpperCase(),
          billingPeriod:
            raw.billingPeriod === 'none' || raw.billingPeriod === 'month' || raw.billingPeriod === 'year'
              ? raw.billingPeriod
              : 'month',
          storiesPerMonth:
            this.asPositiveInt(raw.storiesPerMonth) ?? 5,
          voiceProfiles:
            this.asPositiveInt(raw.voiceProfiles) ?? 1,
          audioGenerationsPerMonth:
            this.asPositiveInt(planRecord.audioGenerationsPerMonth) ?? 5,
          storeProductIdIos:
            this.asNonEmptyString(raw.storeProductIdIos) ?? '',
          storeProductIdAndroid:
            this.asNonEmptyString(raw.storeProductIdAndroid) ?? '',
          isActive: this.asBoolean(raw.isActive) ?? true,
        });
      }

      return Object.fromEntries(resolved.entries());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to read dynamic plan settings. Falling back to defaults. ${message}`,
      );
      return defaults;
    }
  }

  private async getPlanLimits(planId?: string | null) {
    const plans = await this.getResolvedPlanSettings();
    const selected =
      Object.values(plans).find((plan) => plan.id === planId) ??
      plans.FREE ??
      Object.values(plans)[0];
    return {
      planId: selected.id,
      storiesPerMonth: selected.storiesPerMonth,
      voiceProfiles: selected.voiceProfiles,
      audioGenerationsPerMonth: selected.audioGenerationsPerMonth,
    };
  }

  private async resolvePlanFromProductId(
    productId: string,
  ): Promise<PlanSettings | null> {
    const plans = await this.getResolvedPlanSettings();
    const normalized = productId.toLowerCase();

    for (const plan of Object.values(plans)) {
      if (plan.storeProductIdIos.toLowerCase() === normalized) return plan;
      if (plan.storeProductIdAndroid.toLowerCase() === normalized) return plan;
    }

    const byCode = Object.values(plans).find(
      (plan) => plan.code.toLowerCase() === normalized,
    );
    if (byCode) return byCode;

    if (normalized.includes('enterprise')) return plans.ENTERPRISE ?? null;
    if (normalized.includes('platinum')) return plans.PLATINUM ?? null;
    if (normalized.includes('premium')) return plans.PREMIUM ?? null;
    if (normalized.includes('free')) return plans.FREE ?? null;
    return null;
  }

  private resolveDurationDays(plan: PlanSettings, productId: string): number {
    const normalized = `${plan.billingPeriod} ${productId}`.toLowerCase();
    if (normalized.includes('year')) return 365;
    if (normalized.includes('week')) return 7;
    if (normalized.includes('none')) return 0;
    return 30;
  }

  private paymentMethodForPlatform(platform: IapPlatform): PaymentMethod {
    return platform === IapPlatform.IOS
      ? PaymentMethod.APPLE_PAY
      : PaymentMethod.GOOGLE_PAY;
  }

  private validatePurchasePayload(dto: ValidateIapReceiptDto) {
    if (!dto.productId ) {
      throw new BadRequestException('Missing IAP Product Id metadata');
    }
  }

  private parseIsoDate(dateValue: string, fieldName: string): Date {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date string`);
    }
    return parsed;
  }

  async getPlans() {
    const plans = await this.getResolvedPlanSettings();

    return {
      source: 'iap',
      provider: 'apple-google-stores',
      plans: Object.values(plans)
        .map((plan) => ({
          id: plan.id,
          code: plan.code,
          displayName: plan.displayName,
          displayPrice: plan.displayPrice,
          currency: plan.currency,
          billingPeriod: plan.billingPeriod,
          limits: {
            storiesPerMonth: plan.storiesPerMonth,
            voiceProfiles: plan.voiceProfiles,
            audioGenerationsPerMonth: plan.audioGenerationsPerMonth,
          },
          storeProductIds: {
            ios: plan.storeProductIdIos,
            android: plan.storeProductIdAndroid,
          },
          isActive: plan.isActive,
        }))
        .filter((p) => p.isActive),
    };
  }

  async validateIapReceipt(userId: string, dto: ValidateIapReceiptDto) {
    this.validatePurchasePayload(dto);

    const existingTransaction = await this.prismaService.payment.findFirst({
      where: {
        userId,
      },
      select: {
        id: true,
      },
    });

    if (existingTransaction) {
      const existingUser = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          currentSubscriptionPlanId: true,
          subscriptionStatus: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
        },
      });

      if (!existingUser) {
        throw new BadRequestException('User not found');
      }

      return {
        message: 'IAP transaction already recorded',
        source: 'mobile-client-self-reported',
        subscription: existingUser,
        entitlement: await this.getPlanLimits(existingUser.currentSubscriptionPlanId),
      };
    }

    const planSettings = await this.getResolvedPlanSettings();
    //@ts-ignore - TypeScript version does not support satisfies operator
    const mappedPlan = await this.resolvePlanFromProductId(dto.productId);
    const planById = dto.planId
      ? Object.values(planSettings).find((plan) => plan.id === dto.planId)
      : undefined;

    if (dto.planId && !planById) {
      throw new BadRequestException('Invalid planId');
    }
    if (planById && mappedPlan && planById.id !== mappedPlan.id) {
      throw new BadRequestException('planId does not match productId mapping');
    }

    const selectedPlan =
      planById ??
      mappedPlan ??
      (planSettings.FREE ?? Object.values(planSettings)[0]);
      Object.values(planSettings)[0];

    const tier = selectedPlan.code;
    const subscriptionPlanId = selectedPlan.id;
        //@ts-ignore - TypeScript version does not support satisfies operator
    const durationDays = this.resolveDurationDays(selectedPlan, dto.productId);
    const startDate = dto.purchaseDate
      ? this.parseIsoDate(dto.purchaseDate, 'purchaseDate')
      : new Date();
    const endDate = dto.expiresDate
      ? this.parseIsoDate(dto.expiresDate, 'expiresDate')
      : new Date(startDate.getTime() + durationDays * 86400000);
    if (endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException('expiresDate must be after purchaseDate');
    }
    const status = dto.status ?? SubscriptionStatus.ACTIVE;
    const amount = dto.amount ?? selectedPlan.displayPrice;
    const fallbackCurrency = selectedPlan.currency;
    const currency = (dto.currency ?? fallbackCurrency).toLowerCase();
        //@ts-ignore - TypeScript version does not support satisfies operatorS
    const paymentMethod = this.paymentMethodForPlatform(dto.platform);
    const userTier = Object.values(SubscriptionTier).includes(selectedPlan.code as SubscriptionTier)
      ? (selectedPlan.code as SubscriptionTier)
      : selectedPlan.displayPrice > 0
        ? SubscriptionTier.PREMIUM
        : SubscriptionTier.FREE;

    const updatedUser = await this.prismaService.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          userId,
          subscriptionPlanId,
          amount,
          currency,
          status: PaymentStatus.SUCCEEDED,
          paymentMethod,
          description: `IAP ${tier} purchase`,
          metadata: {
            source: 'mobile-client',
            platform: dto.platform,
            productId: dto.productId,
            transactionId: dto.transactionId,
            purchaseToken: dto.purchaseToken,
            receiptData: dto.receiptData,
            reportedStatus: dto.status,
            purchaseDate: dto.purchaseDate,
            expiresDate: dto.expiresDate,
          },
          paidAt: new Date(),
        },
      });

      await tx.subscriptionHistory.create({
        data: {
          userId,
          subscriptionPlanId,
          tier: userTier,
          status,
          stripePriceId: dto.productId,
          startDate,
          endDate,
          amount,
          currency,
          interval: durationDays >= 365 ? 'year' : 'month',
          metadata: {
            source: 'mobile-client',
            platform: dto.platform,
            productId: dto.productId,
            transactionId: dto.transactionId,
            purchaseToken: dto.purchaseToken,
            receiptData: dto.receiptData,
          },
        },
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          currentSubscriptionPlanId: subscriptionPlanId,
          subscriptionTier: userTier,
          subscriptionStatus: status,
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          cancelAtPeriodEnd: false,
        },
        select: {
          id: true,
          currentSubscriptionPlanId: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
        },
      });
    });

    return {
      message: 'IAP purchase recorded and entitlement synced',
      source: 'mobile-client-self-reported',
      subscription: updatedUser,
      entitlement: await this.getPlanLimits(updatedUser.currentSubscriptionPlanId),
    };
  }

  async syncIapEntitlement(userId: string) {
    const plans = await this.getResolvedPlanSettings();
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        currentSubscriptionPlanId: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');

    const now = new Date();
    const isActive =
      !!user.subscriptionEndDate &&
      user.subscriptionEndDate.getTime() > now.getTime();

    const status = isActive
      ? SubscriptionStatus.ACTIVE
      : SubscriptionStatus.INACTIVE;
    const currentPlanId =
      user.currentSubscriptionPlanId ?? plans.FREE?.id ?? Object.values(plans)[0].id;
    const currentPlan =
      Object.values(plans).find((plan) => plan.id === currentPlanId) ??
      plans.FREE ??
      Object.values(plans)[0];
    const tier = currentPlan.displayPrice > 0
      ? SubscriptionTier.PREMIUM
      : SubscriptionTier.FREE;

    const updated = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        currentSubscriptionPlanId: currentPlanId,
        subscriptionStatus: status,
        subscriptionTier: tier,
      },
      select: {
        id: true,
        currentSubscriptionPlanId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
      },
    });

    return {
      message: 'Entitlement sync complete',
      source: 'iap',
      subscription: updated,
      entitlement: await this.getPlanLimits(updated.currentSubscriptionPlanId),
    };
  }

  async getMySubscription(userId: string) {
    const plans = await this.getResolvedPlanSettings();
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        currentSubscriptionPlanId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        cancelAtPeriodEnd: true,
        storiesGeneratedThisMonth: true,
        voiceProfilesCount: true,
        audioGeneratedThisMonth: true,
      },
    });

    if (!user) throw new BadRequestException('User not found');

    const limits = await this.getPlanLimits(user.currentSubscriptionPlanId);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [storiesGeneratedThisMonth, voiceProfilesCount] =
      await this.prismaService.$transaction([
        this.prismaService.story.count({
          where: {
            userId,
            createdAt: {
              gte: monthStart,
            },
          },
        }),
        this.prismaService.voiceProfile.count({
          where: {
            userId,
            isActive: true,
          },
        }),
      ]);

    const activePlan =
      Object.values(plans).find((p) => p.id === user.currentSubscriptionPlanId) ??
      plans.FREE ??
      Object.values(plans)[0];

    return {
      source: 'iap',
      subscription: {
        planId: activePlan?.id ?? null,
        tier: user.subscriptionTier,
        displayName: activePlan?.displayName,
        status: user.subscriptionStatus,
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      },
      usage: {
        storiesGeneratedThisMonth,
        voiceProfilesCount,
        audioGeneratedThisMonth: user.audioGeneratedThisMonth,
        limits,
      },
    };
  }

  async createCheckoutSession(userId: string, priceId: string) {
    void userId;
    void priceId;
    throw new BadRequestException(
      'Stripe checkout is disabled. Use /subscription/iap/validate for in-app purchases.',
    );
  }

  async handleWebhook(event: any) {
    void event;
    throw new BadRequestException(
      'Stripe webhook is disabled. This backend is configured for IAP-only subscriptions.',
    );

    // idempotency stored in StripeWebhookEvent table
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
