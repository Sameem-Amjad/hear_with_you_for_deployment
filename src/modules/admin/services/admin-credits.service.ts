import { Injectable, Logger } from '@nestjs/common';
import { CredentialProvider } from '@prisma/client';
import { ProviderCredentialsService } from '../../provider-credentials/provider-credentials.service';

@Injectable()
export class AdminCreditsService {
  private readonly logger = new Logger(AdminCreditsService.name);

  constructor(
    private readonly credentialsService: ProviderCredentialsService,
  ) {}

  async getProviderCreditsStatus() {
    const [elevenLabs, openAi] = await Promise.allSettled([
      this.getElevenLabsStatus(),
      this.getOpenAiStatus(),
    ]);

    return {
      elevenLabs:
        elevenLabs.status === 'fulfilled'
          ? elevenLabs.value
          : { error: this.extractMessage(elevenLabs.reason) },
      openAi:
        openAi.status === 'fulfilled'
          ? openAi.value
          : { error: this.extractMessage(openAi.reason) },
    };
  }

  private extractMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private async getElevenLabsStatus() {
    const apiKey = await this.credentialsService.getProviderKey(
      CredentialProvider.ELEVENLABS,
    );

    const headers = { 'xi-api-key': apiKey };

    const [subRes, voicesRes] = await Promise.all([
      fetch('https://api.elevenlabs.io/v1/user/subscription', { headers }),
      fetch('https://api.elevenlabs.io/v1/voices', { headers }),
    ]);

    if (!subRes.ok) {
      const body = await subRes.json().catch(() => ({})) as any;
      throw new Error(
        body?.detail?.message ?? `ElevenLabs API error: ${subRes.status}`,
      );
    }

    const sub = await subRes.json() as any;
    const voicesBody = voicesRes.ok ? await voicesRes.json() as any : null;

    const voicesUsed: number = Array.isArray(voicesBody?.voices)
      ? voicesBody.voices.length
      : (sub.voice_add_edit_counter ?? 0);
    const voicesLimit: number = sub.voice_limit ?? 0;
    const voicesRemaining = Math.max(0, voicesLimit - voicesUsed);

    const charsUsed: number = sub.character_count ?? 0;
    const charsLimit: number = sub.character_limit ?? 0;
    const charsRemaining = Math.max(0, charsLimit - charsUsed);

    return {
      tier: sub.tier as string | undefined,
      status: sub.status as string | undefined,
      characters: {
        used: charsUsed,
        limit: charsLimit,
        remaining: charsRemaining,
        percentUsed:
          charsLimit > 0 ? Math.round((charsUsed / charsLimit) * 100) : 0,
        resetsAt:
          sub.next_character_reset_unix
            ? new Date((sub.next_character_reset_unix as number) * 1000).toISOString()
            : null,
      },
      voices: {
        used: voicesUsed,
        limit: voicesLimit,
        remaining: voicesRemaining,
        percentUsed:
          voicesLimit > 0 ? Math.round((voicesUsed / voicesLimit) * 100) : 0,
      },
      nextInvoice:
        sub.next_invoice
          ? {
              amountDollars: ((sub.next_invoice.amount_due_cents as number) / 100).toFixed(2),
              dueAt: new Date(
                (sub.next_invoice.next_payment_attempt_unix as number) * 1000,
              ).toISOString(),
            }
          : null,
    };
  }

  private async getOpenAiStatus() {
    const apiKey = await this.credentialsService.getProviderKey(
      CredentialProvider.OPENAI,
    );

    const authHeaders = { Authorization: `Bearer ${apiKey}` };

    // Confirm key is valid first
    const modelsRes = await fetch('https://api.openai.com/v1/models', {
      headers: authHeaders,
    });

    if (!modelsRes.ok) {
      const body = await modelsRes.json().catch(() => ({})) as any;
      throw new Error(
        body?.error?.message ?? `OpenAI API error: ${modelsRes.status}`,
      );
    }

    // Try the newer balance endpoint (requires org admin key)
    let balance: { availableUsd: string } | null = null;
    try {
      const balRes = await fetch(
        'https://api.openai.com/v1/organization/balance',
        { headers: authHeaders },
      );
      if (balRes.ok) {
        const balBody = await balRes.json() as any;
        const available = Array.isArray(balBody?.available)
          ? balBody.available
          : [];
        const usdEntry = available.find((b: any) => b.currency === 'usd') as any;
        if (usdEntry) {
          balance = { availableUsd: (usdEntry.amount as number).toFixed(2) };
        }
      }
    } catch {
      // Not available for this key type — skip silently
    }

    // Try legacy billing endpoints (works for some account types)
    let billing: {
      hardLimitUsd: number;
      softLimitUsd: number;
      usageThisMonthUsd: string;
      remainingEstimateUsd: string;
    } | null = null;
    try {
      const today = new Date();
      const startDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      )
        .toISOString()
        .split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      const [subRes, usageRes] = await Promise.all([
        fetch('https://api.openai.com/dashboard/billing/subscription', {
          headers: authHeaders,
        }),
        fetch(
          `https://api.openai.com/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
          { headers: authHeaders },
        ),
      ]);

      if (subRes.ok && usageRes.ok) {
        const sub = await subRes.json() as any;
        const usage = await usageRes.json() as any;
        const hardLimit: number = sub.hard_limit_usd ?? 0;
        const usageCents: number = usage.total_usage ?? 0;
        const usageUsd = usageCents / 100;
        billing = {
          hardLimitUsd: hardLimit,
          softLimitUsd: sub.soft_limit_usd ?? 0,
          usageThisMonthUsd: usageUsd.toFixed(2),
          remainingEstimateUsd: Math.max(0, hardLimit - usageUsd).toFixed(2),
        };
      }
    } catch {
      // Legacy billing not available for this account type — skip silently
    }

    return {
      keyValid: true,
      balance,
      billing,
      note:
        !balance && !billing
          ? 'Credit balance data is not available for this API key type. The key is valid and functional.'
          : undefined,
    };
  }
}
