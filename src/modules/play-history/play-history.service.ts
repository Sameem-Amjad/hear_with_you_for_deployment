import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { storyReadSelect } from '../story/story.service';
import { DeletedObject$ } from '@aws-sdk/client-s3';

@Injectable()
export class PlayHistoryService {
  constructor(private readonly prismaService: PrismaService) {}

  private toStoryWithVoiceState<
    T extends {
      audioStatus?: string;
      audioUrl?: string | null;
      audioDuration?: number | null;
      playCount?: number;
      completionCount?: number;
      averageRating?: number | null;
      voiceProfileId?: string | null;
      voiceProfile?: { typeCode: number } | null;
      isFeatured?: boolean;
    },
  >(
    story: T,
  ) {
    const { isFeatured, voiceProfile, ...rest } = story;
    const type = story.voiceProfileId ? (voiceProfile?.typeCode ?? null) : null;

    const formatAudioDuration = (durationSeconds: number): string => {
      if (durationSeconds < 60) {
        return `${durationSeconds} sec`;
      }

      const durationMinutes = Math.floor(durationSeconds / 60);
      const remainingSeconds = durationSeconds % 60;

      if (durationMinutes < 60) {
        return `${durationMinutes}:${String(remainingSeconds).padStart(2, '0')} min`;
      }

      const durationHours = Math.floor(durationMinutes / 60);
      const remainingMinutes = durationMinutes % 60;

      if (durationHours < 24) {
        return `${durationHours}:${String(remainingMinutes).padStart(2, '0')} hour`;
      }

      const durationDays = Math.floor(durationHours / 24);
      const remainingHours = durationHours % 24;
      return `${durationDays}:${String(remainingHours).padStart(2, '0')} day`;
    };

    const audioDuration =
      typeof rest.audioDuration === 'number'
        ? formatAudioDuration(rest.audioDuration)
        : null;

    return {
      ...rest,
      audioDuration,
      isFavorite: Boolean(isFeatured),
      type,
      playCount: rest.playCount ?? 0,
      completionCount: rest.completionCount ?? 0,
      averageRating: rest.averageRating ?? null,
      isVoiceStoryCreated:
        rest.audioStatus === 'COMPLETED' && Boolean(rest.audioUrl),
    };
  }

  async saveProgress(
    userId: string,
    dto: {
      storyId: string;
      childProfileId?: string;
      playbackPositionSeconds?: number;
      completionRate?: number;
      wasCompleted?: boolean;
      deviceType?: string;
      platform?: string;
    },
  ) {
    const story = await this.prismaService.story.findFirst({
      where: { id: dto.storyId, userId },
      select: { id: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const now = new Date();

    const playHistory = await this.prismaService.playHistory.create({
      data: {
        storyId: dto.storyId,
        userId,
        childProfileId: dto.childProfileId,
        duration: dto.playbackPositionSeconds,
        completionRate: dto.completionRate,
        wasCompleted: dto.wasCompleted ?? false,
        deviceType: dto.deviceType,
        platform: dto.platform,
        playedAt: now,
      },
    });

    await this.prismaService.story.update({
      where: { id: dto.storyId },
      data: {
        lastPlayedAt: now,
        playCount: { increment: 1 },
        ...(dto.wasCompleted ? { completionCount: { increment: 1 } } : {}),
      },
    });

    return { message: 'Playback progress saved', playHistory };
  }

  async listContinueListening(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, grouped] = await this.prismaService.$transaction([
      this.prismaService.playHistory.findMany({
        where: { userId },
        distinct: ['storyId'],
        orderBy: { playedAt: 'desc' },
        skip,
        take: limit,
        include: {
          story: {
            select: storyReadSelect,
          },
        },
      }),
      this.prismaService.playHistory.groupBy({
        by: ['storyId'],
        where: { userId },
        orderBy: { storyId: 'asc' },
      }),
    ]);

    return {
      items: items.map((item:any) => ({
        ...this.toStoryWithVoiceState(item.story),
        playedAt: item.playedAt,
        playbackPositionSeconds: item.duration,
        completionRate: item.completionRate,
        wasCompleted: item.wasCompleted,
      })),
      total: grouped.length,
      page,
      limit,
    };
  }
}
