import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    const pushToken = await this.prismaService.pushToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });

    return { message: 'Push token registered', pushToken };
  }

  async removePushToken(userId: string, token: string) {
    await this.prismaService.pushToken.deleteMany({
      where: { userId, token },
    });

    return { message: 'Push token removed' };
  }

  async notifyUser(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string | null;
    actionText?: string | null;
    data?: Record<string, unknown>;
  }) {
    try {
      const notification = await this.prismaService.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          actionUrl: params.actionUrl ?? null,
          actionText: params.actionText ?? null,
          data: params.data
            ? (params.data as Prisma.InputJsonValue)
            : undefined,
        },
      });

      const pushTokens = await this.prismaService.pushToken.findMany({
        where: { userId: params.userId, isActive: true },
        select: { token: true },
      });

      if (!pushTokens.length) {
        return { notification, pushSent: false };
      }

      const tokenList = pushTokens.map((item) => item.token);
      const response = await this.firebaseService.sendPushNotification({
        tokens: tokenList,
        title: params.title,
        body: params.message,
        data: this.buildPushData({
          notificationId: notification.id,
          type: params.type,
          actionUrl: params.actionUrl,
          actionText: params.actionText,
          data: params.data,
        }),
      });

      const invalidTokens = new Set<string>();
      response?.responses.forEach((item, index) => {
        if (!item.success) {
          const code = item.error?.code ?? '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.add(tokenList[index]);
          }
        }
      });

      if (invalidTokens.size > 0) {
        await this.prismaService.pushToken.deleteMany({
          where: { token: { in: [...invalidTokens] } },
        });
      }

      if (response && response.failureCount > 0) {
        this.logger.warn(
          `Sent notification ${notification.id} with ${response.failureCount} push delivery failures`,
        );
      }

      return { notification, pushSent: true, pushResponse: response };
    } catch (error) {
      this.logger.warn(
        `Failed to persist or send notification for user ${params.userId}: ${String(error)}`,
      );
      return { notification: null, pushSent: false };
    }
  }

  private buildPushData(params: {
    notificationId: string;
    type: NotificationType;
    actionUrl?: string | null;
    actionText?: string | null;
    data?: Record<string, unknown>;
  }): Record<string, string> {
    const dataEntries = Object.entries(params.data ?? {}).map(
      ([key, value]) => [key, this.toStringValue(value)] as const,
    );

    return {
      notificationId: params.notificationId,
      type: params.type,
      ...(params.actionUrl ? { actionUrl: params.actionUrl } : {}),
      ...(params.actionText ? { actionText: params.actionText } : {}),
      ...Object.fromEntries(dataEntries),
    };
  }

  private toStringValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value);
  }

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
