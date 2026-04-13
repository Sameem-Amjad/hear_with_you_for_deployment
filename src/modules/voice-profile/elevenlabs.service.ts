import { Injectable, Logger } from '@nestjs/common';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service';
import { CredentialProvider } from '@prisma/client';

type ElevenLabsAddVoiceResponse = {
  voice_id: string;
};

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);

  constructor(
    private readonly credentialsService: ProviderCredentialsService,
  ) {}

  private async getApiKey(): Promise<string> {
    return this.credentialsService.getProviderKey(
      CredentialProvider.ELEVENLABS,
    );
  }

  private createClient(): ElevenLabsClient {
    return new ElevenLabsClient({
      apiKey: async () => this.getApiKey(),
    });
  }

  private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  async addVoice(params: {
    name: string;
    description?: string;
    files: Array<{ filename: string; buffer: Buffer; mimetype: string }>;
  }): Promise<ElevenLabsAddVoiceResponse> {
    const client = this.createClient();

    try {
      const response = await client.voices.ivc.create({
        name: params.name,
        description: params.description,
        files: params.files.map((file) => ({
          data: file.buffer,
          filename: file.filename,
          contentType: file.mimetype,
        })),
      });

      return { voice_id: response.voiceId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`ElevenLabs addVoice failed: ${message}`);
      throw new Error('ElevenLabs voice cloning failed');
    }
  }

  async deleteVoice(voiceId: string): Promise<void> {
    const client = this.createClient();

    try {
      await client.voices.delete(voiceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`ElevenLabs deleteVoice failed: ${message}`);
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
    const client = this.createClient();

    try {
      const audioStream = await client.textToSpeech.convert(params.voiceId, {
        text: params.text,
        modelId: params.modelId ?? 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
        voiceSettings: params.voiceSettings
          ? {
              stability: params.voiceSettings.stability,
              similarityBoost: params.voiceSettings.similarity_boost,
              style: params.voiceSettings.style,
              useSpeakerBoost: params.voiceSettings.use_speaker_boost,
            }
          : undefined,
      });

      return this.streamToBuffer(audioStream);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`ElevenLabs TTS failed: ${message}`);
      throw new Error('ElevenLabs TTS failed');
    }
  }
}
