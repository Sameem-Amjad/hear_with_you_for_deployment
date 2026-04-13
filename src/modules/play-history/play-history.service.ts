import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayHistoryService {
  constructor(private readonly prismaService: PrismaService) {}

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
          story: true,
        },
      }),
      this.prismaService.playHistory.groupBy({
        by: ['storyId'],
        where: { userId },
        orderBy: { storyId: 'asc' },
      }),
    ]);

    return {
      items: items.map((item) => ({
        story: item.story,
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
