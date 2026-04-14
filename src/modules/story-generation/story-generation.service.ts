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

  async getJobStatus(userId: string, queueJobId: string) {
    const queueJob = await this.prismaService.queueJob.findFirst({
      where: {
        id: queueJobId,
        userId,
      },
      select: {
        id: true,
        status: true,
        queue: true,
        type: true,
        jobId: true,
        error: true,
        result: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!queueJob) {
      throw new NotFoundException('Queue job not found');
    }

    const result = (queueJob.result ?? null) as
      | { storyId?: string }
      | null;

    return {
      queueJob: {
        id: queueJob.id,
        status: queueJob.status,
        queue: queueJob.queue,
        type: queueJob.type,
        jobId: queueJob.jobId,
        error: queueJob.error,
        createdAt: queueJob.createdAt,
        updatedAt: queueJob.updatedAt,
      },
      storyId: result?.storyId ?? null,
    };
  }
}
