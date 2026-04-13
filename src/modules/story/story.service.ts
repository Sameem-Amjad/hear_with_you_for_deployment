import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { API_MESSAGES } from '../../common/constants/api.messages';
import {
  StoryDuration,
  SubscriptionTier,
  UsageAction,
  ResourceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoryPromptService } from './story-prompt.service';
import { OpenAiService } from './openai.service';
import { GenerateStoryDto } from './dto/generate-story.dto';

type GeneratedStory = {
  title: string;
  content: string;
  summary?: string;
  moralLesson?: string;
  characterNames?: string[];
};

@Injectable()
export class StoryService {
  private readonly cache = new LRUCache<string, GeneratedStory>({
    max: 5000,
    ttl: 5 * 60 * 1000,
  });

  constructor(
    private readonly prismaService: PrismaService,
    private readonly promptService: StoryPromptService,
    private readonly openAiService: OpenAiService,
  ) {}

  private toStoryWithVoiceState<T extends { audioStatus?: string; audioUrl?: string | null }>(
    story: T,
  ) {
    return {
      ...story,
      isVoiceStoryCreated:
        story.audioStatus === 'COMPLETED' && Boolean(story.audioUrl),
    };
  }

  private async getMonthlyStoryLimit(params: {
    subscriptionTier: SubscriptionTier;
    currentSubscriptionPlanId?: string | null;
  }): Promise<number> {
    const plan = params.currentSubscriptionPlanId
      ? await this.prismaService.subscriptionPlan.findUnique({
          where: { id: params.currentSubscriptionPlanId },
          select: { storiesPerMonth: true },
        })
      : await this.prismaService.subscriptionPlan.findUnique({
          where: { code: params.subscriptionTier },
          select: { storiesPerMonth: true },
        });

    return plan?.storiesPerMonth ?? 5;
  }

  async generate(userId: string, dto: GenerateStoryDto) {
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
      subscriptionTier: user.subscriptionTier,
      currentSubscriptionPlanId: user.currentSubscriptionPlanId,
    });
    if (user.storiesGeneratedThisMonth >= limit) {
      throw new ForbiddenException(API_MESSAGES.STORY.ERROR.LIMIT_REACHED);
    }

    const child = dto.childProfileId
      ? await this.prismaService.childProfile.findFirst({
          where: { id: dto.childProfileId, userId },
        })
      : null;

    const system = this.promptService.buildSystemPrompt({
      ageGroup: dto.ageGroup,
      language: dto.language ?? 'en',
    });
    const userPrompt = this.promptService.buildUserPrompt({
      theme: dto.theme,
      ageGroup: dto.ageGroup,
      duration: dto.duration ?? StoryDuration.MEDIUM,
      child,
      customPrompt: dto.customPrompt,
    });

    const cacheKey = JSON.stringify({
      theme: dto.theme,
      ageGroup: dto.ageGroup,
      duration: dto.duration ?? StoryDuration.MEDIUM,
      language: dto.language ?? 'en',
      childId: child?.id ?? null,
      customPrompt: dto.customPrompt ?? '',
    });

    let generated = this.cache.get(cacheKey);
    let tokensUsed: number | undefined;
    let modelUsed: string | undefined;

    if (!generated) {
      const res = await this.openAiService.generateJson({
        system,
        user: userPrompt,
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
          childProfileId: child?.id,
          title: generated.title,
          content: generated.content,
          summary: generated.summary,
          moralLesson: generated.moralLesson,
          theme: dto.theme,
          ageGroup: dto.ageGroup,
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

      await tx.usageHistory.create({
        data: {
          userId,
          resourceType: ResourceType.STORY,
          resourceId: created.id,
          action: UsageAction.GENERATED,
          tokensUsed,
          metadata: {
            model: modelUsed ?? 'gpt-4o-mini',
            theme: dto.theme,
            ageGroup: dto.ageGroup,
            duration: dto.duration ?? StoryDuration.MEDIUM,
          },
        },
      });

      return created;
    });

    return {
      message: API_MESSAGES.STORY.SUCCESS.GENERATED,
      story: this.toStoryWithVoiceState(story),
    };
  }

  async get(userId: string, id: string) {
    const story = await this.prismaService.story.findFirst({
      where: { id, userId },
    });
    if (!story) throw new NotFoundException('Story not found');
    return { story: this.toStoryWithVoiceState(story) };
  }

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.story.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.story.count({ where: { userId } }),
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
      select: { id: true },
    });
    if (!story) throw new NotFoundException('Story not found');

    const favorite = await this.prismaService.favorite.upsert({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
      update: {},
      create: {
        userId,
        storyId,
      },
    });

    return { message: 'Added to favorites', favorite };
  }

  async removeFavorite(userId: string, storyId: string) {
    const favorite = await this.prismaService.favorite.findUnique({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
      select: { id: true },
    });

    if (!favorite) {
      return { message: 'Removed from favorites' };
    }

    await this.prismaService.favorite.delete({
      where: {
        userId_storyId: {
          userId,
          storyId,
        },
      },
    });
    return { message: 'Removed from favorites' };
  }

  async listFavorites(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          story: true,
        },
      }),
      this.prismaService.favorite.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => ({
        favoritedAt: item.createdAt,
        story: this.toStoryWithVoiceState(item.story),
      })),
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
          story: true,
        },
      }),
      this.prismaService.playHistory.groupBy({
        by: ['storyId'],
        where: { userId },
        orderBy: { storyId: 'asc' },
      }),
    ]);

    const storyIds = recentPlays.map((item) => item.storyId);
    const favorites = storyIds.length
      ? await this.prismaService.favorite.findMany({
          where: {
            userId,
            storyId: { in: storyIds },
          },
          select: { storyId: true },
        })
      : [];
    const favoriteSet = new Set(favorites.map((f) => f.storyId));

    return {
      items: recentPlays.map((item) => ({
        story: this.toStoryWithVoiceState(item.story),
        playedAt: item.playedAt,
        playbackPositionSeconds: item.duration,
        completionRate: item.completionRate,
        isFavorite: favoriteSet.has(item.storyId),
      })),
      total: grouped.length,
      page,
      limit,
    };
  }
}
