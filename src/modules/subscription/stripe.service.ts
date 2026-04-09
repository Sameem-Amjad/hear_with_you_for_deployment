/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service';
import { CredentialProvider } from '@prisma/client';

@Injectable()
export class StripeService {
  constructor(
    private readonly credentialsService: ProviderCredentialsService,
  ) {}

  private async client(): Promise<any> {
    const secretKey = await this.credentialsService.getProviderKey(
      CredentialProvider.STRIPE,
    );
    const StripeCtor = Stripe as unknown as any;
    return new StripeCtor(secretKey, {
      apiVersion: '2025-01-27.acacia',
      typescript: true,
    });
  }

  async createCheckoutSession(params: {
    customerEmail?: string | null;
    customerId?: string | null;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<any> {
    const stripe = await this.client();
    return stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId ?? undefined,
      customer_email: params.customerId
        ? undefined
        : (params.customerEmail ?? undefined),
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
  }

  async constructEvent(params: {
    payload: Buffer;
    signature: string;
    webhookSecret: string;
  }): Promise<any> {
    const stripe = await this.client();
    return stripe.webhooks.constructEvent(
      params.payload,
      params.signature,
      params.webhookSecret,
    );
  }
}
