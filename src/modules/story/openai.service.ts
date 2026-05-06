import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service';
import { CredentialProvider } from '@prisma/client';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(
    private readonly credentialsService: ProviderCredentialsService,
  ) {}

  private async client(): Promise<OpenAI> {
    const apiKey = await this.credentialsService.getProviderKey(
      CredentialProvider.OPENAI,
    );
    return new OpenAI({ apiKey, timeout: 30_000 });
  }

  async generateJson(params: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ json: unknown; model: string; tokensUsed?: number }> {
    const client = await this.client();
    const model = params.model ?? 'gpt-4o-mini';
    const res = await client.chat.completions.create({
      model,
      temperature: params.temperature ?? 0.8,
      max_tokens: params.maxTokens ?? 1200,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      response_format: { type: 'json_object' },
    });

    const choice = res.choices[0];
    if (choice?.finish_reason === 'length') {
      this.logger.error(
        `OpenAI response truncated (finish_reason=length). ` +
          `Requested max_tokens=${params.maxTokens ?? 1200}, ` +
          `used=${res.usage?.total_tokens}. Increase the tier token cap.`,
      );
      throw new Error('OpenAI response truncated — token limit too low');
    }

    const content = choice?.message?.content ?? '{}';
    try {
      return {
        json: JSON.parse(content) as unknown,
        model,
        tokensUsed: res.usage?.total_tokens,
      };
    } catch {
      this.logger.error(
        `OpenAI returned non-JSON (finish_reason=${choice?.finish_reason}): ${content.slice(0, 300)}`,
      );
      throw new Error('OpenAI response parsing failed');
    }
  }
}
