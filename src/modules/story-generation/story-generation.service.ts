import { Injectable, NotFoundException } from '@nestjs/common';
import { JobType, Prisma } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateStoryDto } from '../story/dto/generate-story.dto';

@Injectable()
export class StoryGenerationService {
  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
  ) {}

  async enqueueStoryText(userId: string, dto: GenerateStoryDto) {
    return this.queueService.enqueue({
      queue: QUEUE_NAMES.STORY_GENERATION,
      name: QUEUE_JOB_NAMES.STORY_GENERATE_TEXT,
      type: JobType.STORY_GENERATE,
      payload: {
        userId,
        storyDto: dto as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
      userId,
      priority: 0,
      attempts: 3,
      backoffMs: 2000,
    });
  }

  async getStatus(userId: string, storyId: string) {
    const story = await this.prismaService.story.findFirst({
      where: { id: storyId, userId },
      select: {
        id: true,
        audioStatus: true,
        audioUrl: true,
        audioError: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!story) throw new NotFoundException('Story not found');

    const lastJob = await this.prismaService.queueJob.findFirst({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      story,
      queueJob: lastJob
        ? {
            id: lastJob.id,
            queue: lastJob.queue,
            type: lastJob.type,
            status: lastJob.status,
            jobId: lastJob.jobId,
            error: lastJob.error,
            createdAt: lastJob.createdAt,
            updatedAt: lastJob.updatedAt,
          }
        : null,
    };
  }
}
