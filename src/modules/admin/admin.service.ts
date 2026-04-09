import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
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

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.user.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
          name: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      this.prismaService.user.count({ where: { isDeleted: false } }),
    ]);
    return { items, total, page, limit };
  }
}
