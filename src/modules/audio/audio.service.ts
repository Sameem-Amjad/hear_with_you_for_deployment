import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeStatic from 'ffprobe-static';
import {
  AudioStatus,
  NotificationType,
  Prisma,
  ResourceType,
  UsageAction,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ElevenLabsService, ELEVENLABS_ERR } from '../voice-profile/elevenlabs.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';

if (ffprobeStatic.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
  ) {}

  private async getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg(url).ffprobe((err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const duration = metadata.format.duration;
        if (!duration || Number.isNaN(duration)) {
          resolve(0);
          return;
        }

        resolve(Math.max(0, Math.round(duration)));
      });
    });
  }

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

  private async syncVoiceProfileUsage(params: {
    tx: Prisma.TransactionClient;
    userId: string;
    voiceProfileId: string;
  }): Promise<void> {
    const [storiesCount, aggregate] = await Promise.all([
      params.tx.story.count({
        where: {
          userId: params.userId,
          voiceProfileId: params.voiceProfileId,
          audioStatus: AudioStatus.COMPLETED,
        },
      }),
      params.tx.story.aggregate({
        where: {
          userId: params.userId,
          voiceProfileId: params.voiceProfileId,
          audioStatus: AudioStatus.COMPLETED,
        },
        _max: {
          updatedAt: true,
        },
      }),
    ]);

    await params.tx.voiceProfile.updateMany({
      where: {
        id: params.voiceProfileId,
        userId: params.userId,
      },
      data: {
        timesUsed: storiesCount,
        lastUsedAt: aggregate._max.updatedAt ?? null,
      },
    });
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

    const voiceProfileId = params.voiceProfileId;
    if (!voiceProfileId) {
      throw new BadRequestException('Voice profile is required');
    }

    if (story.audioStatus === AudioStatus.PROCESSING) {
      throw new BadRequestException('Audio generation is already in progress');
    }

    if (!story.content?.trim()) {
      throw new BadRequestException('Story content is empty');
    }

    const voiceProfile = await this.prismaService.voiceProfile.findFirst({
      where: { id: voiceProfileId, userId: params.userId, isActive: true },
    });
    if (!voiceProfile?.elevenLabsVoiceId) {
      throw new BadRequestException('Voice profile is not ready for TTS');
    }

    if (
      story.audioStatus === AudioStatus.COMPLETED &&
      story.audioUrl &&
      story.voiceProfileId === voiceProfileId
    ) {
      return {
        message: 'Audio already generated for this story and voice profile',
        story: {
          ...story,
          type: voiceProfile.typeCode ?? null,
        },
      };
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

    const text = story.content.trim();
    const totalChars = text.length;

    try {
      const audioBuffer = await this.elevenLabsService.textToSpeech({
        voiceId: voiceProfile.elevenLabsVoiceId,
        text,
        modelId: voiceProfile.elevenLabsModelId ?? undefined,
        voiceSettings: {
          stability: voiceProfile.stability,
          similarity_boost: voiceProfile.similarityBoost,
          style: voiceProfile.style,
          use_speaker_boost: voiceProfile.useSpeakerBoost,
        },
      });

      const uploaded = await this.storageService.uploadAudioBuffer({
        buffer: audioBuffer,
        folder: `audio/${params.userId}/${story.id}`,
        filenameHint: `${story.id}.mp3`,
        contentType: 'audio/mpeg',
      });

      let audioDuration = 0;
      try {
        audioDuration = await this.getAudioDuration(uploaded.url);
      } catch (probeError) {
        this.logger.warn(
          `Failed to probe audio duration for story ${story.id}: ${probeError instanceof Error ? probeError.message : String(probeError)}`,
        );
      }

      const updated = await this.prismaService.$transaction(async (tx) => {
        const s = await tx.story.update({
          where: { id: story.id },
          data: {
            voiceProfileId: voiceProfile.id,
            audioUrl: uploaded.url,
            audioS3Key: uploaded.key,
            audioSize: uploaded.size,
            audioFormat: 'mp3',
            audioDuration,
            audioStatus: AudioStatus.COMPLETED,
          },
        });

        const affectedVoiceProfileIds = Array.from(
          new Set(
            [story.voiceProfileId, voiceProfile.id].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        );

        for (const affectedVoiceProfileId of affectedVoiceProfileIds) {
          await this.syncVoiceProfileUsage({
            tx,
            userId: params.userId,
            voiceProfileId: affectedVoiceProfileId,
          });
        }

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
              chunks: 1,
            },
          },
        });

        await tx.user.update({
          where: { id: params.userId },
          data: { audioGeneratedThisMonth: { increment: 1 } },
        });

        return s;
      });

      await this.notificationService.notifyUser({
        userId: params.userId,
        type: NotificationType.STORY_READY,
        title: 'Audio ready',
        message: `Audio is ready for "${story.title}".`,
        actionUrl: `/stories/${updated.id}`,
        actionText: 'Listen now',
        data: {
          storyId: updated.id,
          audioStatus: 'COMPLETED',
        },
      });

      return {
        message: 'Audio generated successfully',
        story: {
          ...updated,
          type: voiceProfile.typeCode ?? null,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prismaService.story.update({
        where: { id: story.id },
        data: { audioStatus: AudioStatus.FAILED, audioError: message },
      });

      if (message === ELEVENLABS_ERR.CREDITS_EXHAUSTED) {
        void this.mailService.sendAdminAlert(
          'ACTION REQUIRED: ElevenLabs audio credits exhausted',
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#c0392b">ElevenLabs Audio Credits Exhausted</h2>
            <p>An audio generation request failed because the ElevenLabs account has <strong>run out of credits</strong>.</p>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:6px 12px;font-weight:bold">Time</td><td style="padding:6px 12px">${new Date().toISOString()}</td></tr>
              <tr style="background:#f5f5f5"><td style="padding:6px 12px;font-weight:bold">User ID</td><td style="padding:6px 12px">${params.userId}</td></tr>
              <tr><td style="padding:6px 12px;font-weight:bold">Story ID</td><td style="padding:6px 12px">${params.storyId}</td></tr>
            </table>
            <p style="margin-top:20px">Please <strong>top up or upgrade your ElevenLabs plan</strong> to restore audio generation.</p>
          </div>`,
        );
        throw new ForbiddenException(
          'ElevenLabs quota exceeded. Please top up or upgrade your ElevenLabs plan.',
        );
      }

      throw new BadRequestException('Audio generation failed');
    }
  }
}
