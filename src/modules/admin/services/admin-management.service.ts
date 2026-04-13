import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  StoryTheme,
  SubscriptionStatus,
  SubscriptionTier,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminSettingsService } from './admin-settings.service';
import { changePct, parseRangeDays } from '../utils/admin-metrics.util';

@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly settingsService: AdminSettingsService,
  ) {}

  async listUsers(
    page = 1,
    limit = 20,
    filters?: { search?: string; tier?: SubscriptionTier; status?: string },
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      ...(filters?.tier ? { subscriptionTier: filters.tier } : {}),
      ...(filters?.status === 'active'
        ? { isActive: true }
        : filters?.status === 'inactive'
          ? { isActive: false }
          : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { phone: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          profilePicture: true,
          email: true,
          phone: true,
          username: true,
          name: true,
          isActive: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          createdAt: true,
          lastActiveAt: true,
          _count: {
            select: {
              voiceProfiles: true,
              stories: true,
            },
          },
        },
      }),
      this.prismaService.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        profilePicture: user.profilePicture,
        email: user.email,
        phone: user.phone,
        username: user.username,
        name: user.name,
        isActive: user.isActive,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        voicesCount: user._count.voiceProfiles,
        storiesCount: user._count.stories,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      })),
      total,
      page,
      limit,
    };
  }

  async updateUserStatus(
    id: string,
    dto: { isActive: boolean; reason?: string },
  ) {
    const existing = await this.prismaService.user.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prismaService.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: { id: true, isActive: true, updatedAt: true },
    });

    return {
      message: dto.isActive ? 'User enabled' : 'User disabled',
      reason: dto.reason,
      user,
    };
  }

  async deleteUser(id: string) {
    const existing = await this.prismaService.user.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('User not found');
    }

    await this.prismaService.user.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });

    return { message: 'User deleted' };
  }

  async listStories(
    page = 1,
    limit = 20,
    filters?: { search?: string; theme?: StoryTheme; from?: string; to?: string },
  ) {
    const skip = (page - 1) * limit;
    const createdAt: Prisma.DateTimeFilter | undefined =
      filters?.from || filters?.to
        ? {
            ...(filters?.from ? { gte: new Date(filters.from) } : {}),
            ...(filters?.to ? { lte: new Date(filters.to) } : {}),
          }
        : undefined;

    const where: Prisma.StoryWhereInput = {
      ...(filters?.theme ? { theme: filters.theme } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(filters?.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              {
                user: {
                  name: { contains: filters.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total, aggregate, storiesToday] = await this.prismaService.$transaction([
      this.prismaService.story.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true } },
          voiceProfile: { select: { id: true, name: true } },
        },
      }),
      this.prismaService.story.count({ where }),
      this.prismaService.story.aggregate({
        where,
        _sum: { playCount: true },
      }),
      this.prismaService.story.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
    ]);

    return {
      items: items.map((story) => ({
        id: story.id,
        title: story.title,
        theme: story.theme,
        duration: story.duration,
        playCount: story.playCount,
        createdAt: story.createdAt,
        userName: story.user?.name,
        voiceName: story.voiceProfile?.name,
        isFeatured: story.isFeatured,
      })),
      total,
      page,
      limit,
      summary: {
        totalStories: total,
        totalPlays: aggregate._sum.playCount ?? 0,
        storiesToday,
      },
    };
  }

  async updateStoryFeature(id: string, isFeatured: boolean) {
    const story = await this.prismaService.story.update({
      where: { id },
      data: { isFeatured },
      select: { id: true, isFeatured: true, updatedAt: true },
    });

    return { message: 'Story feature status updated', story };
  }

  async listTemplates(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.storyTemplate.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.storyTemplate.count(),
    ]);
    return { items, total, page, limit };
  }

  async createTemplate(dto: {
    name: string;
    description?: string;
    theme: StoryTheme;
    ageGroup: any;
    promptTemplate: string;
    placeholders?: string[];
    tags?: string[];
    thumbnailUrl?: string;
    isFeatured?: boolean;
    isActive?: boolean;
  }) {
    const template = await this.prismaService.storyTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        theme: dto.theme,
        ageGroup: dto.ageGroup,
        promptTemplate: dto.promptTemplate,
        placeholders: dto.placeholders ?? [],
        tags: dto.tags ?? [],
        thumbnailUrl: dto.thumbnailUrl,
        isFeatured: dto.isFeatured ?? false,
        isActive: dto.isActive ?? true,
      },
    });
    return { message: 'Template created', template };
  }

  async updateTemplate(id: string, dto: Prisma.StoryTemplateUpdateInput) {
    const template = await this.prismaService.storyTemplate.update({
      where: { id },
      data: dto,
    });
    return { message: 'Template updated', template };
  }

  async archiveTemplate(id: string) {
    await this.prismaService.storyTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Template archived' };
  }

  async subscriptionsOverview(range: string) {
    const days = parseRangeDays(range);
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86400000);
    const previousStart = new Date(currentStart.getTime() - days * 86400000);

    const [currentRows, previousRows, activeUsers, usersForDistribution] =
      await this.prismaService.$transaction([
        this.prismaService.payment.findMany({
          where: {
            status: PaymentStatus.SUCCEEDED,
            createdAt: { gte: currentStart },
          },
          select: { amount: true },
        }),
        this.prismaService.payment.findMany({
          where: {
            status: PaymentStatus.SUCCEEDED,
            createdAt: { gte: previousStart, lt: currentStart },
          },
          select: { amount: true },
        }),
        this.prismaService.user.count({
          where: { isDeleted: false, subscriptionStatus: SubscriptionStatus.ACTIVE },
        }),
        this.prismaService.user.findMany({
          where: { isDeleted: false },
          select: { subscriptionTier: true },
        }),
      ]);

    const currentRevenue = currentRows.reduce((sum, p) => sum + p.amount, 0);
    const previousRevenue = previousRows.reduce((sum, p) => sum + p.amount, 0);
    const groupedUsers = Object.values(SubscriptionTier).map((tier) => {
      const users = usersForDistribution.filter(
        (u) => u.subscriptionTier === tier,
      ).length;
      return { subscriptionTier: tier, users };
    });
    const totalUsers = groupedUsers.reduce((sum, g) => sum + g.users, 0);
    const plans = await this.settingsService.getSubscriptionPlanSettings();

    return {
      monthlyRevenue: {
        value: Number(currentRevenue.toFixed(2)),
        changePct: changePct(currentRevenue, previousRevenue),
      },
      activeSubscriptions: {
        value: activeUsers,
      },
      planDistribution: groupedUsers.map((g) => ({
        tier: g.subscriptionTier,
        users: g.users,
        percent: totalUsers
          ? Number(((g.users / totalUsers) * 100).toFixed(2))
          : 0,
        displayPrice:
          plans.planSettings?.[g.subscriptionTier]?.displayPrice ??
          this.settingsService.getPlanDefaults()[g.subscriptionTier]?.displayPrice ??
          0,
      })),
    };
  }

  async subscriptionTransactions(
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      tier?: SubscriptionTier;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const createdAt: Prisma.DateTimeFilter | undefined =
      filters?.from || filters?.to
        ? {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          }
        : undefined;

    const where: Prisma.PaymentWhereInput = {
      ...(filters?.status
        ? {
            status: filters.status.toUpperCase() as PaymentStatus,
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(filters?.tier ? { user: { subscriptionTier: filters.tier } } : {}),
      ...(filters?.search
        ? {
            OR: [
              {
                user: {
                  name: { contains: filters.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  email: { contains: filters.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
              subscriptionTier: true,
            },
          },
        },
      }),
      this.prismaService.payment.count({ where }),
    ]);

    return {
      items: items.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
        user: payment.user,
        metadata: payment.metadata,
      })),
      total,
      page,
      limit,
    };
  }
}
