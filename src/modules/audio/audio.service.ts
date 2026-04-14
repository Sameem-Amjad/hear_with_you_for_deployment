import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AudioStatus, ResourceType, UsageAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ElevenLabsService } from '../voice-profile/elevenlabs.service';
import { AudioProcessorService } from './audio-processor.service';

@Injectable()
export class AudioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly audioProcessor: AudioProcessorService,
  ) {}

  private async getMonthlyAudioLimit(userId: string): Promise<number> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        currentSubscriptionPlanId: true,
        subscriptionTier: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const plan = user.currentSubscriptionPlanId
      ? await this.prismaService.subscriptionPlan.findUnique({
          where: { id: user.currentSubscriptionPlanId },
          select: { audioGenerationsPerMonth: true },
        })
      : null;

    return plan?.audioGenerationsPerMonth ?? 5;
  }

  async generateForStory(params: {
    userId: string;
    storyId: string;
    voiceProfileId?: string;
  }) {
    const story = await this.prismaService.story.findFirst({
      where: { id: params.storyId, userId: params.userId },
    });
    if (!story) throw new NotFoundException('Story not found');

    const voiceProfileId = params.voiceProfileId ?? story.voiceProfileId;
    if (!voiceProfileId) {
      throw new BadRequestException('Voice profile is required');
    }

    const voiceProfile = await this.prismaService.voiceProfile.findFirst({
      where: { id: voiceProfileId, userId: params.userId, isActive: true },
    });
    if (!voiceProfile?.elevenLabsVoiceId) {
      throw new BadRequestException('Voice profile is not ready for TTS');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: params.userId },
      select: { audioGeneratedThisMonth: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const audioLimit = await this.getMonthlyAudioLimit(params.userId);
    if (user.audioGeneratedThisMonth >= audioLimit) {
      throw new ForbiddenException('Monthly audio generation limit reached');
    }

    await this.prismaService.story.update({
      where: { id: story.id },
      data: { audioStatus: AudioStatus.PROCESSING, audioError: null },
    });

    const chunks = this.audioProcessor.chunkText(story.content, 5000);
    const buffers: Buffer[] = [];
    let totalChars = 0;

    try {
      for (const chunk of chunks) {
        totalChars += chunk.length;
        const buf = await this.elevenLabsService.textToSpeech({
          voiceId: voiceProfile.elevenLabsVoiceId,
          text: chunk,
          modelId: voiceProfile.elevenLabsModelId ?? undefined,
          voiceSettings: {
            stability: voiceProfile.stability,
            similarity_boost: voiceProfile.similarityBoost,
            style: voiceProfile.style,
            use_speaker_boost: voiceProfile.useSpeakerBoost,
          },
        });
        buffers.push(buf);
      }

      const audioBuffer = Buffer.concat(buffers);
      const uploaded = await this.storageService.uploadAudioBuffer({
        buffer: audioBuffer,
        folder: `audio/${params.userId}/${story.id}`,
        filenameHint: `${story.id}.mp3`,
        contentType: 'audio/mpeg',
      });

      const updated = await this.prismaService.$transaction(async (tx) => {
        const s = await tx.story.update({
          where: { id: story.id },
          data: {
            voiceProfileId: voiceProfile.id,
            audioUrl: uploaded.url,
            audioS3Key: uploaded.key,
            audioSize: uploaded.size,
            audioFormat: 'mp3',
            audioStatus: AudioStatus.COMPLETED,
            elevenLabsCharactersUsed: totalChars,
          },
        });

        await tx.usageHistory.create({
          data: {
            userId: params.userId,
            resourceType: ResourceType.AUDIO,
            resourceId: s.id,
            action: UsageAction.GENERATED,
            charactersUsed: totalChars,
            storageUsed: uploaded.size,
            metadata: {
              voiceProfileId: voiceProfile.id,
              chunks: chunks.length,
            },
          },
        });

        await tx.user.update({
          where: { id: params.userId },
          data: { audioGeneratedThisMonth: { increment: 1 } },
        });

        return s;
      });

      return { message: 'Audio generated successfully', story: updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prismaService.story.update({
        where: { id: story.id },
        data: { audioStatus: AudioStatus.FAILED, audioError: message },
      });
      throw new BadRequestException('Audio generation failed');
    }
  }
}
