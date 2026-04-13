import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.notification.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prismaService.notification.findFirst({
      where: { id, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    const updated = await this.prismaService.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'Notification marked as read', notification: updated };
  }
}
