import { Injectable } from '@nestjs/common';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { changePct, parseRangeDays } from '../utils/admin-metrics.util';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async overview() {
    const [users, stories, voiceProfiles, payments] =
      await this.prismaService.$transaction([
        this.prismaService.user.count({ where: { isDeleted: false } }),
        this.prismaService.story.count(),
        this.prismaService.voiceProfile.count(),
        this.prismaService.payment.count(),
      ]);
    return { users, stories, voiceProfiles, payments };
  }

  async dashboardOverview(range: string) {
    const days = parseRangeDays(range);
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 86400000);
    const previousStart = new Date(currentStart.getTime() - days * 86400000);

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      currentStories,
      previousStories,
      currentRevenueRows,
      previousRevenueRows,
      currentActiveSubs,
      previousActiveSubs,
    ] = await this.prismaService.$transaction([
      this.prismaService.user.count({ where: { isDeleted: false } }),
      this.prismaService.user.count({ where: { isDeleted: false, isActive: true } }),
      this.prismaService.user.count({ where: { isDeleted: false, isActive: false } }),
      this.prismaService.story.count({ where: { createdAt: { gte: currentStart } } }),
      this.prismaService.story.count({
        where: { createdAt: { gte: previousStart, lt: currentStart } },
      }),
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
      this.prismaService.user.count({
        where: {
          isDeleted: false,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          updatedAt: { gte: previousStart, lt: currentStart },
        },
      }),
    ]);

    const currentRevenue = currentRevenueRows.reduce((sum, p) => sum + p.amount, 0);
    const previousRevenue = previousRevenueRows.reduce((sum, p) => sum + p.amount, 0);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
      },
      subscriptions: {
        active: currentActiveSubs,
        changePct: changePct(currentActiveSubs, previousActiveSubs),
      },
      revenue: {
        current: Number(currentRevenue.toFixed(2)),
        previous: Number(previousRevenue.toFixed(2)),
        changePct: changePct(currentRevenue, previousRevenue),
        currency: 'USD',
      },
      stories: {
        current: currentStories,
        previous: previousStories,
        changePct: changePct(currentStories, previousStories),
      },
    };
  }

  async dashboardRevenue(range: string) {
    const days = parseRangeDays(range);
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);

    const rows = await this.prismaService.payment.findMany({
      where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: start } },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const bucket = new Map<string, number>();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      bucket.set(key, Number(((bucket.get(key) ?? 0) + row.amount).toFixed(2)));
    }

    const series = Array.from(bucket.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));

    return {
      range: `${days}d`,
      series,
      total: Number(rows.reduce((sum, p) => sum + p.amount, 0).toFixed(2)),
      currency: 'USD',
    };
  }

  async dashboardUserGrowth(range: string) {
    const days = parseRangeDays(range);
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);

    const [createdUsers, activeEvents] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        where: { createdAt: { gte: start }, isDeleted: false },
        select: { createdAt: true },
      }),
      this.prismaService.user.findMany({
        where: { lastActiveAt: { gte: start }, isDeleted: false },
        select: { lastActiveAt: true },
      }),
    ]);

    const newMap = new Map<string, number>();
    const activeMap = new Map<string, number>();

    for (const row of createdUsers) {
      const key = row.createdAt.toISOString().slice(0, 10);
      newMap.set(key, (newMap.get(key) ?? 0) + 1);
    }
    for (const row of activeEvents) {
      if (!row.lastActiveAt) continue;
      const key = row.lastActiveAt.toISOString().slice(0, 10);
      activeMap.set(key, (activeMap.get(key) ?? 0) + 1);
    }

    const keys = new Set<string>([
      ...Array.from(newMap.keys()),
      ...Array.from(activeMap.keys()),
    ]);
    const series = Array.from(keys)
      .sort()
      .map((date) => ({
        date,
        newUsers: newMap.get(date) ?? 0,
        activeUsers: activeMap.get(date) ?? 0,
      }));

    return {
      range: `${days}d`,
      series,
      totals: {
        newUsers: createdUsers.length,
        activeUsers: activeEvents.length,
      },
    };
  }

  async dashboardRecentActivity(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.activityHistory.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              isActive: true,
            },
          },
        },
      }),
      this.prismaService.activityHistory.count(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        user: item.user,
        action: item.action,
        description: item.description,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
    };
  }
}
