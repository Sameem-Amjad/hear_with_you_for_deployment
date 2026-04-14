import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderCredentialsService } from '../../provider-credentials/provider-credentials.service';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly credentialsService: ProviderCredentialsService,
    private readonly configService: ConfigService,
  ) {}

  getPlanDefaults() {
    return {
      FREE: {
        id: 'plan_free',
        code: 'FREE',
        displayName: 'Basic',
        displayPrice: 0,
        currency: 'USD',
        storiesPerMonth: 5,
        voiceProfiles: 1,
        audioGenerationsPerMonth: 5,
        isActive: true,
        storeProductIds: { ios: '', android: '' },
      },
      PREMIUM: {
        id: 'plan_premium',
        code: 'PREMIUM',
        displayName: 'Premium',
        displayPrice: Number(this.configService.get('IAP_PREMIUM_PRICE') ?? 9.99),
        currency: 'USD',
        storiesPerMonth: 50,
        voiceProfiles: 3,
        audioGenerationsPerMonth: 50,
        isActive: true,
        storeProductIds: { ios: '', android: '' },
      },
      PLATINUM: {
        id: 'plan_platinum',
        code: 'PLATINUM',
        displayName: 'Platinum',
        displayPrice: Number(
          this.configService.get('IAP_PLATINUM_PRICE') ?? 19.99,
        ),
        currency: 'USD',
        storiesPerMonth: 1000000,
        voiceProfiles: 10,
        audioGenerationsPerMonth: 1000000,
        isActive: true,
        storeProductIds: { ios: '', android: '' },
      },
      ENTERPRISE: {
        id: 'plan_enterprise',
        code: 'ENTERPRISE',
        displayName: 'Enterprise',
        displayPrice: Number(
          this.configService.get('IAP_ENTERPRISE_PRICE') ?? 49.99,
        ),
        currency: 'USD',
        storiesPerMonth: 1000000,
        voiceProfiles: 10,
        audioGenerationsPerMonth: 1000000,
        isActive: false,
        storeProductIds: { ios: '', android: '' },
      },
    };
  }

  async getProviderSettings() {
    const records = await this.prismaService.providerCredential.findMany({
      orderBy: { provider: 'asc' },
      select: {
        provider: true,
        keyVersion: true,
        isActive: true,
        lastRotatedAt: true,
        updatedAt: true,
      },
    });

    const byProvider = new Map(records.map((r) => [r.provider, r]));
    const providers = Object.values(CredentialProvider).map((provider) => {
      const record = byProvider.get(provider);
      return {
        provider,
        isConfigured: !!record,
        isActive: record?.isActive ?? false,
        keyVersion: record?.keyVersion ?? 0,
        lastRotatedAt: record?.lastRotatedAt ?? null,
        updatedAt: record?.updatedAt ?? null,
      };
    });

    return { providers };
  }

  async updateProviderKey(provider: string, apiKey: string) {
    const normalized = provider.toUpperCase();
    if (!(normalized in CredentialProvider)) {
      throw new BadRequestException('Unsupported provider');
    }

    const enumProvider = normalized as CredentialProvider;
    await this.credentialsService.setProviderKey(enumProvider, apiKey);

    const record = await this.prismaService.providerCredential.findUnique({
      where: { provider: enumProvider },
      select: {
        provider: true,
        keyVersion: true,
        isActive: true,
        lastRotatedAt: true,
      },
    });

    return {
      message: 'Provider key updated',
      provider: record,
    };
  }

  async getSubscriptionPlanSettings() {
    const defaults = this.getPlanDefaults();

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
            billingPeriod: plan.code === 'FREE' ? 'none' : 'month',
            storiesPerMonth: plan.storiesPerMonth,
            voiceProfiles: plan.voiceProfiles,
            audioGenerationsPerMonth: plan.audioGenerationsPerMonth,
            storeProductIdIos: plan.storeProductIds.ios,
            storeProductIdAndroid: plan.storeProductIds.android,
            isActive: plan.isActive,
          },
          update: {},
        }),
      ),
    );

    const rows = await this.prismaService.subscriptionPlan.findMany();
    const fromDb = Object.fromEntries(
      rows.map((row): [string, any] => {
        const planRow = row as any;
        return [planRow.code, {
          id: planRow.id,
          code: planRow.code,
          displayName: planRow.displayName,
          displayPrice: planRow.displayPrice,
          currency: planRow.currency,
          billingPeriod: planRow.billingPeriod,
          storiesPerMonth: planRow.storiesPerMonth,
          voiceProfiles: planRow.voiceProfiles,
          audioGenerationsPerMonth: planRow.audioGenerationsPerMonth,
          storeProductIds: {
            ios: planRow.storeProductIdIos ?? '',
            android: planRow.storeProductIdAndroid ?? '',
          },
          isActive: planRow.isActive,
        }];
      }),
    );

    return {
      planSettings: {
        ...defaults,
        ...fromDb,
      },
    };
  }

  async updateSubscriptionPlanSetting(
    code: string,
    dto: {
      displayName?: string;
      displayPrice?: number;
      currency?: string;
      storiesPerMonth?: number;
      voiceProfiles?: number;
      audioGenerationsPerMonth?: number;
      storeProductIds?: { ios?: string; android?: string };
      isActive?: boolean;
    },
  ) {
    const normalized = code.toUpperCase();

    const existing = await this.getSubscriptionPlanSettings();
    const currentPlan =
      (existing.planSettings?.[normalized] as Record<string, unknown> | undefined) ??
      this.getPlanDefaults()[normalized] ??
      {
        id: `plan_${normalized.toLowerCase()}`,
        code: normalized,
        displayName: normalized,
        displayPrice: 0,
        currency: 'USD',
        billingPeriod: 'month',
        storiesPerMonth: 5,
        voiceProfiles: 1,
        audioGenerationsPerMonth: 5,
        isActive: true,
        storeProductIds: { ios: '', android: '' },
      };

    const updatedPlan = {
      ...currentPlan,
      ...dto,
      code: normalized,
    };

    await this.prismaService.subscriptionPlan.upsert({
      where: { code: normalized as any },
      create: {
        id:
          (updatedPlan.id as string | undefined) ??
          `plan_${normalized.toLowerCase()}`,
        code: normalized as any,
        displayName:
          (updatedPlan.displayName as string | undefined) ?? normalized,
        displayPrice: Number(updatedPlan.displayPrice ?? 0),
        currency: (updatedPlan.currency as string | undefined) ?? 'USD',
        billingPeriod:
          (updatedPlan.billingPeriod as string | undefined) ??
          (normalized === 'FREE' ? 'none' : 'month'),
        storiesPerMonth: Number(updatedPlan.storiesPerMonth ?? 5),
        voiceProfiles: Number(updatedPlan.voiceProfiles ?? 1),
        audioGenerationsPerMonth: Number(updatedPlan.audioGenerationsPerMonth ?? 5),
        storeProductIdIos:
          (updatedPlan.storeProductIds as { ios?: string } | undefined)?.ios ??
          '',
        storeProductIdAndroid:
          (updatedPlan.storeProductIds as { android?: string } | undefined)
            ?.android ?? '',
        isActive: Boolean(updatedPlan.isActive ?? true),
      },
      update: {
        displayName:
          (updatedPlan.displayName as string | undefined) ?? undefined,
        displayPrice:
          updatedPlan.displayPrice !== undefined
            ? Number(updatedPlan.displayPrice)
            : undefined,
        currency: (updatedPlan.currency as string | undefined) ?? undefined,
        storiesPerMonth:
          updatedPlan.storiesPerMonth !== undefined
            ? Number(updatedPlan.storiesPerMonth)
            : undefined,
        voiceProfiles:
          updatedPlan.voiceProfiles !== undefined
            ? Number(updatedPlan.voiceProfiles)
            : undefined,
        audioGenerationsPerMonth:
          updatedPlan.audioGenerationsPerMonth !== undefined
            ? Number(updatedPlan.audioGenerationsPerMonth)
            : undefined,
        storeProductIdIos:
          (updatedPlan.storeProductIds as { ios?: string } | undefined)?.ios ??
          undefined,
        storeProductIdAndroid:
          (updatedPlan.storeProductIds as { android?: string } | undefined)
            ?.android ?? undefined,
        isActive:
          updatedPlan.isActive !== undefined
            ? Boolean(updatedPlan.isActive)
            : undefined,
      },
    });

    return {
      message: 'Plan updated',
      plan: updatedPlan,
    };
  }
}
