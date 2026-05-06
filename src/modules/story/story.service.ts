import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { API_MESSAGES } from '../../common/constants/api.messages';
import {
  AudioStatus,
  NotificationType,
  SubscriptionTier,
  StoryTheme,
  StoryDuration,
  UsageAction,
  ResourceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { StoryPromptService } from './story-prompt.service';
import { OpenAiService } from './openai.service';
import { GenerateStoryDto } from './dto/generate-story.dto';
import { RecordStoryPlayDto } from './dto/record-story-play.dto';

type GeneratedStory = {
  title: string;
  content: string;
  characterNames?: string[];
};

export const storyReadSelect = {
  id: true,
  userId: true,
  voiceProfileId: true,
  voiceProfile: {
    select: {
      typeCode: true,
    },
  },
  title: true,
  content: true,
  isFeatured: true,
  playCount: true,
  completionCount: true,
  averageRating: true,
  promptUsed: true,
  audioStatus: true,
  audioUrl: true,
  audioDuration: true,
  audioFormat: true,
  lastPlayedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class StoryService {
  private static readonly FREE_TIER_MAX_TOKENS = 900;
  private static readonly PAID_TIER_MAX_TOKENS = 1800;

  private readonly cache = new LRUCache<string, GeneratedStory>({
    max: 5000,
    ttl: 5 * 60 * 1000,
  });

  constructor(
    private readonly prismaService: PrismaService,
    private readonly promptService: StoryPromptService,
    private readonly openAiService: OpenAiService,
    private readonly notificationService: NotificationService,
  ) {}

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
      createdAt: Date;
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
        elevenLabsRequestId:null,
        isFeatured: Boolean(isFeatured),
        publishedAt: story.createdAt,
    };
  }

  private async getMonthlyStoryLimit(params: {
    currentSubscriptionPlanId?: string | null;
  }): Promise<number> {
    const plan = params.currentSubscriptionPlanId
      ? await this.prismaService.subscriptionPlan.findUnique({
          where: { id: params.currentSubscriptionPlanId },
          select: { storiesPerMonth: true },
        })
      : null;

    return plan?.storiesPerMonth ?? 5;
  }

  private getPerRequestTokenCap(tier: SubscriptionTier): number {
    return tier === SubscriptionTier.FREE
      ? StoryService.FREE_TIER_MAX_TOKENS
      : StoryService.PAID_TIER_MAX_TOKENS;
  }

  async generate(userId: string, dto: GenerateStoryDto) {
    const selectedTemplate = dto.templateId
      ? await this.prismaService.storyTemplate.findFirst({
          where: {
            id: dto.templateId,
            isActive: true,
            isPublished: true,
          },
          select: {
            id: true,
            templatePrompt: true,
          },
        })
      : null;

    if (dto.templateId && !selectedTemplate) {
      throw new BadRequestException('Template not found or inactive');
    }

    const resolvedTheme = dto.theme ?? StoryTheme.CUSTOM;
    const resolvedAgeGroup = dto.ageGroup ?? ('GENERAL' as any);

    if (!selectedTemplate && !dto.customPrompt && !dto.theme) {
      throw new BadRequestException(
        'Provide customPrompt or select theme/template for story generation',
      );
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionTier: true,
        currentSubscriptionPlanId: true,
        storiesGeneratedThisMonth: true,
        isActive: true,
        isDeleted: true,
      },
    });
    if (!user || user.isDeleted || !user.isActive) {
      throw new NotFoundException('User not found');
    }

    const limit = await this.getMonthlyStoryLimit({
      currentSubscriptionPlanId: user.currentSubscriptionPlanId,
    });
    if (user.storiesGeneratedThisMonth >= limit) {
      throw new ForbiddenException(API_MESSAGES.STORY.ERROR.LIMIT_REACHED);
    }

    const system = this.promptService.buildSystemPrompt({
      ageGroup: resolvedAgeGroup,
      language: dto.language ?? 'en',
    });
    const userPrompt = this.promptService.buildUserPrompt({
      theme: resolvedTheme,
      ageGroup: resolvedAgeGroup,
      duration: dto.duration ?? StoryDuration.MEDIUM,
      templatePrompt: selectedTemplate?.templatePrompt,
      customPrompt: dto.customPrompt,
    });

    const maxTokens = this.getPerRequestTokenCap(user.subscriptionTier);

    const cacheKey = JSON.stringify({
      theme: resolvedTheme,
      ageGroup: resolvedAgeGroup,
      duration: dto.duration ?? StoryDuration.MEDIUM,
      language: dto.language ?? 'en',
      templateId: selectedTemplate?.id ?? null,
      customPrompt: dto.customPrompt ?? '',
      maxTokens,
    });

    let generated = this.cache.get(cacheKey);
    let tokensUsed: number | undefined;
    let modelUsed: string | undefined;

    if (!generated) {
      const res = await this.openAiService.generateJson({
        system,
        user: userPrompt,
        maxTokens,
      });
      tokensUsed = res.tokensUsed;
      modelUsed = res.model;
      generated = res.json as GeneratedStory;
      this.cache.set(cacheKey, generated);
    }

    const story = await this.prismaService.$transaction(async (tx) => {
      const created = await tx.story.create({
        data: {
          userId,
          title: generated.title,
          content: generated.content,
          theme: resolvedTheme,
          ageGroup: resolvedAgeGroup,
          duration: dto.duration ?? StoryDuration.MEDIUM,
          language: dto.language ?? 'en',
          promptUsed: userPrompt,
          openaiModel: modelUsed ?? 'gpt-4o-mini',
          openaiTokensUsed: tokensUsed,
          temperature: 0.8,
          characterNames: generated.characterNames ?? [],
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          storiesGeneratedThisMonth: { increment: 1 },
          totalStoriesGenerated: { increment: 1 },
        },
      });

      return created;
    });

    await this.prismaService.usageHistory.create({
      data: {
        userId,
        resourceType: ResourceType.STORY,
        resourceId: story.id,
        action: UsageAction.GENERATED,
        tokensUsed,
        metadata: {
          model: modelUsed ?? 'gpt-4o-mini',
          theme: resolvedTheme,
          ageGroup: resolvedAgeGroup,
          duration: dto.duration ?? StoryDuration.MEDIUM,
          templateId: selectedTemplate?.id ?? null,
        },
      },
    });

    await this.notificationService.notifyUser({
      userId,
      type: NotificationType.STORY_READY,
      title: 'Story ready',
      message: `Your story "${story.title}" is ready to read.`,
      actionUrl: `/stories/${story.id}`,
      actionText: 'Open story',
      data: {
        storyId: story.id,
        title: story.title,
      },
    });

    return {
      message: API_MESSAGES.STORY.SUCCESS.GENERATED,
      story: this.toStoryWithVoiceState(story),
    };
  }

  async get(userId: string, id: string) {
    const story = await this.prismaService.story.findFirst({
      where: { id, userId },
      select: storyReadSelect,
    });
    if (!story) throw new NotFoundException('Story not found');
    return { story: this.toStoryWithVoiceState(story) };
  }

  async list(
    userId: string,
    page = 1,
    limit = 20,
    options?: { favorite?: boolean; recent?: boolean },
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      userId,
      // Exclude stories whose voice's ElevenLabs voice id is null (not cloned)
      voiceProfile: { is: { elevenLabsVoiceId: { not: null } } },
      ...(options?.favorite ? { isFeatured: true } : {}),
      ...(options?.recent ? { audioStatus: AudioStatus.COMPLETED } : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.story.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: storyReadSelect,
      }),
      this.prismaService.story.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toStoryWithVoiceState(item)),
      total,
      page,
      limit,
    };
  }

  async listAiGenerated(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      userId,
      // audioStatus: AudioStatus.PENDING,
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.story.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: storyReadSelect,
      }),
      this.prismaService.story.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toStoryWithVoiceState(item)),
      total,
      page,
      limit,
    };
  }

  async addFavorite(userId: string, storyId: string) {
    const story = await this.prismaService.story.findFirst({
      where: { id: storyId, userId },
      select: { id: true, isFeatured: true },
    });
    if (!story) throw new NotFoundException('Story not found');

    const updatedStory = await this.prismaService.story.update({
      where: { id: storyId },
      data: { isFeatured: true },
      select: { id: true, isFeatured: true, createdAt: true },
    });

    return { message: 'Added to favorites', favorite: {...updatedStory,storyId:updatedStory.id} };
  }

  async removeFavorite(userId: string, storyId: string) {
    const story = await this.prismaService.story.findFirst({
      where: { id: storyId, userId },
      select: { id: true, isFeatured: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const updatedStory = await this.prismaService.story.update({
      where: { id: storyId },
      data: { isFeatured: false },
      select: { id: true, isFeatured: true, updatedAt: true },
    });

    return { message: 'Removed from favorites', story: updatedStory };
  }

  async recordPlay(userId: string, storyId: string, dto: RecordStoryPlayDto) {
    const story = await this.prismaService.story.findFirst({
      where: { id: storyId, userId },
      select: { id: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const now = new Date();

    const updatedStory = await this.prismaService.$transaction(async (tx) => {
      await tx.playHistory.create({
        data: {
          storyId,
          userId,
          duration: dto.playbackPositionSeconds,
          completionRate: dto.completionRate,
          wasCompleted: dto.wasCompleted ?? false,
          deviceType: dto.deviceType,
          platform: dto.platform,
          playedAt: now,
        },
      });

      return tx.story.update({
        where: { id: storyId },
        data: {
          playCount: { increment: 1 },
          ...(dto.wasCompleted ? { completionCount: { increment: 1 } } : {}),
          lastPlayedAt: now,
        },
        select: {
          id: true,
          title: true,
          playCount: true,
          completionCount: true,
          lastPlayedAt: true,
        },
      });
    });

    return {
      message: 'Story play recorded',
      story: updatedStory,
    };
  }

  async listFavorites(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.story.findMany({
        where: { userId, isFeatured: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: storyReadSelect,
      }),
      this.prismaService.story.count({ where: { userId, isFeatured: true } }),
    ]);

    return {
      items: items.map((item) => this.toStoryWithVoiceState(item)),
      total,
      page,
      limit,
    };
  }

  async listRecent(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [recentPlays, grouped] = await this.prismaService.$transaction([
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
      items: recentPlays.map((item) => ({
        story: this.toStoryWithVoiceState(item.story),
        playedAt: item.playedAt,
        playbackPositionSeconds: item.duration,
        completionRate: item.completionRate,
        isFavorite: item.story.isFeatured,
      })),
      total: grouped.length,
      page,
      limit,
    };
  }
}
