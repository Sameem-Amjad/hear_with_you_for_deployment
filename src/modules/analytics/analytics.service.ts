import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getUsage(userId: string) {
    const byType = await this.prismaService.usageHistory.groupBy({
      by: ['resourceType'],
      where: { userId },
      _count: { _all: true },
      _sum: {
        tokensUsed: true,
        charactersUsed: true,
        creditsUsed: true,
        storageUsed: true,
      },
    });

    return {
      usage: byType.map((r) => ({
        resourceType: r.resourceType,
        count: r._count._all,
        tokensUsed: r._sum.tokensUsed ?? 0,
        charactersUsed: r._sum.charactersUsed ?? 0,
        creditsUsed: r._sum.creditsUsed ?? 0,
        storageUsed: r._sum.storageUsed ?? 0,
      })),
    };
  }
}
