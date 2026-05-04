import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { changePct, parseRangeDays } from '../utils/admin-metrics.util';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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
    // Exclude admin emails from activity feed
    const adminEmailsRaw = this.configService.get<string>('ADMIN_EMAILS') ?? '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

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
              email: true,
              isActive: true,
            },
          },
        },
        where: adminEmails.length
          ? { user: { email: { notIn: adminEmails } } }
          : undefined,
      }),
      this.prismaService.activityHistory.count({
        where: adminEmails.length ? { user: { email: { notIn: adminEmails } } } : undefined,
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        user: {
          id: item.user.id,
          name: item.user.name,
          profilePicture: item.user.profilePicture,
          isActive: item.user.isActive,
        },
        action: item.action,
        description: item.description,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Combined dashboard endpoint: totals (excluding admin), month-over-month deltas,
   * optional range-based series (by passing `range=30d`) or `from`/`to` ISO dates,
   * user growth series and recent activity (excluding admin emails).
   */
  async dashboardCombined(opts: {
    range?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { range, from, to, page = 1, limit = 10 } = opts;

    const adminEmailsRaw = this.configService.get<string>('ADMIN_EMAILS') ?? '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Totals (all time)
    const [totalUsersAll, activeSubsAll, totalRevenueRows, totalStoriesWithAudio] =
      await this.prismaService.$transaction([
        this.prismaService.user.count({
          where: { isDeleted: false, email: adminEmails.length ? { notIn: adminEmails } : undefined },
        }),
        this.prismaService.user.count({
          where: {
            isDeleted: false,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            email: adminEmails.length ? { notIn: adminEmails } : undefined,
          },
        }),
        this.prismaService.payment.findMany({
          where: { status: PaymentStatus.SUCCEEDED },
          select: { amount: true },
        }),
        this.prismaService.story.count({ where: { audioUrl: { not: null } } }),
      ]);

    const totalRevenueAll = totalRevenueRows.reduce((s, p) => s + p.amount, 0);

    // Compute current month and previous month ranges
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [usersCurrentMonth, usersPreviousMonth, revenueCurrentRows, revenuePreviousRows, storiesCurrentMonth, storiesPreviousMonth, subsCurrentMonth, subsPreviousMonth] =
      await this.prismaService.$transaction([
        this.prismaService.user.count({
          where: {
            isDeleted: false,
            createdAt: { gte: startOfCurrentMonth, lt: startOfNextMonth },
            email: adminEmails.length ? { notIn: adminEmails } : undefined,
          },
        }),
        this.prismaService.user.count({
          where: {
            isDeleted: false,
            createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth },
            email: adminEmails.length ? { notIn: adminEmails } : undefined,
          },
        }),
        this.prismaService.payment.findMany({
          where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: startOfCurrentMonth, lt: startOfNextMonth } },
          select: { amount: true },
        }),
        this.prismaService.payment.findMany({
          where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth } },
          select: { amount: true },
        }),
        this.prismaService.story.count({ where: { audioUrl: { not: null }, createdAt: { gte: startOfCurrentMonth, lt: startOfNextMonth } } }),
        this.prismaService.story.count({ where: { audioUrl: { not: null }, createdAt: { gte: startOfPreviousMonth, lt: startOfCurrentMonth } } }),
        this.prismaService.user.count({ where: { isDeleted: false, subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionStartDate: { gte: startOfCurrentMonth, lt: startOfNextMonth }, email: adminEmails.length ? { notIn: adminEmails } : undefined } }),
        this.prismaService.user.count({ where: { isDeleted: false, subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionStartDate: { gte: startOfPreviousMonth, lt: startOfCurrentMonth }, email: adminEmails.length ? { notIn: adminEmails } : undefined } }),
      ]);

    const revenueCurrent = revenueCurrentRows.reduce((s, r) => s + r.amount, 0);
    const revenuePrevious = revenuePreviousRows.reduce((s, r) => s + r.amount, 0);

    // Optional series: prefer from/to ISO range if provided, else parse range days
    let revenueSeries: { date: string; amount: number }[] | null = null;
    let userGrowthSeries: { date: string; newUsers: number; activeUsers: number }[] | null = null;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const rows = await this.prismaService.payment.findMany({
        where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: fromDate, lt: toDate } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const bucket = new Map<string, number>();
      for (const row of rows) {
        const key = row.createdAt.toISOString().slice(0, 10);
        bucket.set(key, (bucket.get(key) ?? 0) + row.amount);
      }
      revenueSeries = Array.from(bucket.entries()).map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }));

      const created = await this.prismaService.user.findMany({ where: { createdAt: { gte: fromDate, lt: toDate }, isDeleted: false }, select: { createdAt: true } });
      const active = await this.prismaService.user.findMany({ where: { lastActiveAt: { gte: fromDate, lt: toDate }, isDeleted: false }, select: { lastActiveAt: true } });
      const newMap = new Map<string, number>();
      const activeMap = new Map<string, number>();
      for (const r of created) {
        const k = r.createdAt.toISOString().slice(0, 10);
        newMap.set(k, (newMap.get(k) ?? 0) + 1);
      }
      for (const r of active) {
        if (!r.lastActiveAt) continue;
        const k = r.lastActiveAt.toISOString().slice(0, 10);
        activeMap.set(k, (activeMap.get(k) ?? 0) + 1);
      }
      const keys = new Set<string>([...Array.from(newMap.keys()), ...Array.from(activeMap.keys())]);
      userGrowthSeries = Array.from(keys).sort().map((date) => ({ date, newUsers: newMap.get(date) ?? 0, activeUsers: activeMap.get(date) ?? 0 }));
    } else if (range) {
      const days = parseRangeDays(range);
      const start = new Date(now.getTime() - days * 86400000);
      const rows = await this.prismaService.payment.findMany({ where: { status: PaymentStatus.SUCCEEDED, createdAt: { gte: start } }, select: { amount: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
      const bucket = new Map<string, number>();
      for (const row of rows) {
        const key = row.createdAt.toISOString().slice(0, 10);
        bucket.set(key, (bucket.get(key) ?? 0) + row.amount);
      }
      revenueSeries = Array.from(bucket.entries()).map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }));

      const created = await this.prismaService.user.findMany({ where: { createdAt: { gte: start }, isDeleted: false }, select: { createdAt: true } });
      const active = await this.prismaService.user.findMany({ where: { lastActiveAt: { gte: start }, isDeleted: false }, select: { lastActiveAt: true } });
      const newMap = new Map<string, number>();
      const activeMap = new Map<string, number>();
      for (const r of created) {
        const k = r.createdAt.toISOString().slice(0, 10);
        newMap.set(k, (newMap.get(k) ?? 0) + 1);
      }
      for (const r of active) {
        if (!r.lastActiveAt) continue;
        const k = r.lastActiveAt.toISOString().slice(0, 10);
        activeMap.set(k, (activeMap.get(k) ?? 0) + 1);
      }
      const keys = new Set<string>([...Array.from(newMap.keys()), ...Array.from(activeMap.keys())]);
      userGrowthSeries = Array.from(keys).sort().map((date) => ({ date, newUsers: newMap.get(date) ?? 0, activeUsers: activeMap.get(date) ?? 0 }));
    }

    // recent activity
    const recent = await this.dashboardRecentActivity(page, limit);

    return {
      totals: {
        totalUsers: totalUsersAll,
        activeSubscriptions: activeSubsAll,
        totalRevenue: Number(totalRevenueAll.toFixed(2)),
        totalStoriesWithAudio,
        currency: 'USD',
      },
      monthComparison: {
        users: { current: usersCurrentMonth, previous: usersPreviousMonth, changePct: changePct(usersCurrentMonth, usersPreviousMonth) },
        subscriptions: { current: subsCurrentMonth, previous: subsPreviousMonth, changePct: changePct(subsCurrentMonth, subsPreviousMonth) },
        revenue: { current: Number(revenueCurrent.toFixed(2)), previous: Number(revenuePrevious.toFixed(2)), changePct: changePct(revenueCurrent, revenuePrevious), currency: 'USD' },
        storiesWithAudio: { current: storiesCurrentMonth, previous: storiesPreviousMonth, changePct: changePct(storiesCurrentMonth, storiesPreviousMonth) },
      },
      series: {
        revenue: revenueSeries,
        userGrowth: userGrowthSeries,
      },
      userGrowth: {
        totals: {
          newUsers: userGrowthSeries ? userGrowthSeries.reduce((s, r) => s + r.newUsers, 0) : 0,
          activeUsers: userGrowthSeries ? userGrowthSeries.reduce((s, r) => s + r.activeUsers, 0) : 0,
          totalUsers: totalUsersAll,
        },
        series: userGrowthSeries,
      },
      recentActivity: recent,
    };
  }
}
