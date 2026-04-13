import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminFeedbackService {
  constructor(private readonly prismaService: PrismaService) {}

  async listFeedback(
    page = 1,
    limit = 20,
    filters?: { search?: string; type?: FeedbackType; status?: string },
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.FeedbackWhereInput = {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { subject: { contains: filters.search, mode: 'insensitive' } },
              { message: { contains: filters.search, mode: 'insensitive' } },
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
      this.prismaService.feedback.findMany({
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
            },
          },
        },
      }),
      this.prismaService.feedback.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async respondFeedback(
    id: string,
    dto: { response: string; status: string },
    respondedBy: string,
  ) {
    const existing = await this.prismaService.feedback.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Feedback not found');

    const feedback = await this.prismaService.feedback.update({
      where: { id },
      data: {
        response: dto.response,
        status: dto.status,
        respondedAt: new Date(),
        respondedBy,
      },
    });

    return { message: 'Feedback updated', feedback };
  }
}
