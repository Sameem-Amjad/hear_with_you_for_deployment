import { Injectable } from '@nestjs/common';
import { Prisma, ActivityHistory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prismaService: PrismaService) {}

  async logActivity(data: {
    userId: string;
    action: string;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<ActivityHistory> {
    return this.prismaService.activityHistory.create({
      data,
    });
  }

  async getUserActivityHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prismaService.$transaction([
      this.prismaService.activityHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.activityHistory.count({
        where: { userId },
      }),
    ]);

    return {
      activity:data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
