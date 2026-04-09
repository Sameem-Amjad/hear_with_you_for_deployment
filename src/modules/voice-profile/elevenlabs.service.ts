import { Injectable, Logger } from '@nestjs/common';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service';
import { CredentialProvider } from '@prisma/client';

type ElevenLabsAddVoiceResponse = {
  voice_id: string;
};

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(
    private readonly credentialsService: ProviderCredentialsService,
  ) {}

  private async getApiKey(): Promise<string> {
    return this.credentialsService.getProviderKey(
      CredentialProvider.ELEVENLABS,
    );
  }

  async addVoice(params: {
    name: string;
    description?: string;
    files: Array<{ filename: string; buffer: Buffer; mimetype: string }>;
  }): Promise<ElevenLabsAddVoiceResponse> {
    const apiKey = await this.getApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const form = new FormData();
    form.append('name', params.name);
    if (params.description) form.append('description', params.description);

    for (const file of params.files) {
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype,
      });
      form.append('files', blob, file.filename);
    }

    const res = await fetch(`${this.baseUrl}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`ElevenLabs addVoice failed: ${res.status} ${text}`);
      throw new Error('ElevenLabs voice cloning failed');
    }

    return (await res.json()) as ElevenLabsAddVoiceResponse;
  }

  async deleteVoice(voiceId: string): Promise<void> {
    const apiKey = await this.getApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`ElevenLabs deleteVoice failed: ${res.status} ${text}`);
      throw new Error('ElevenLabs voice deletion failed');
    }
  }

  async textToSpeech(params: {
    voiceId: string;
    text: string;
    modelId?: string;
    voiceSettings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
  }): Promise<Buffer> {
    const apiKey = await this.getApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(
      `${this.baseUrl}/text-to-speech/${params.voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: params.text,
          model_id: params.modelId ?? 'eleven_multilingual_v2',
          voice_settings: params.voiceSettings ?? undefined,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`ElevenLabs TTS failed: ${res.status} ${text}`);
      throw new Error('ElevenLabs TTS failed');
    }

    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
}
