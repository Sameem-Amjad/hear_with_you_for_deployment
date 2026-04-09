import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { JobStatus, JobType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @InjectQueue('story-generation') private readonly storyQueue: Queue,
    @InjectQueue('audio-generation') private readonly audioQueue: Queue,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue,
  ) {}

  private getQueue(queueName: string): Queue {
    switch (queueName) {
      case 'story-generation':
        return this.storyQueue;
      case 'audio-generation':
        return this.audioQueue;
      case 'cleanup':
        return this.cleanupQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  async enqueue(params: {
    queue: string;
    name: string;
    type: JobType;
    payload: Prisma.InputJsonValue;
    userId?: string;
    storyId?: string;
    priority?: number;
    attempts?: number;
    backoffMs?: number;
  }): Promise<{ job: Job; queueJobId: string }> {
    const queue = this.getQueue(params.queue);
    const created = await this.prismaService.queueJob.create({
      data: {
        queue: params.queue,
        type: params.type,
        status: JobStatus.PENDING,
        priority: params.priority ?? 0,
        payload: params.payload,
        userId: params.userId,
        storyId: params.storyId,
        scheduledAt: new Date(),
        maxAttempts: params.attempts ?? 3,
      },
    });

    const job = await queue.add(params.name, params.payload, {
      priority: params.priority ?? 0,
      attempts: params.attempts ?? 3,
      backoff: params.backoffMs
        ? { type: 'exponential', delay: params.backoffMs }
        : undefined,
      removeOnComplete: { age: 7 * 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });

    await this.prismaService.queueJob.update({
      where: { id: created.id },
      data: { jobId: String(job.id) },
    });

    this.logger.log(
      `Enqueued ${params.queue}:${params.name} jobId=${job.id} queueJobId=${created.id}`,
    );

    return { job, queueJobId: created.id };
  }

  async markProcessing(jobId: string): Promise<void> {
    await this.prismaService.queueJob.updateMany({
      where: { jobId },
      data: { status: JobStatus.PROCESSING, startedAt: new Date() },
    });
  }

  async markCompleted(
    jobId: string,
    result?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prismaService.queueJob.updateMany({
      where: { jobId },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        result: result ?? undefined,
      },
    });
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.prismaService.queueJob.updateMany({
      where: { jobId },
      data: { status: JobStatus.FAILED, failedAt: new Date(), error },
    });
  }

  async cancelJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
    await this.prismaService.queueJob.updateMany({
      where: { jobId },
      data: { status: JobStatus.CANCELLED },
    });
  }
}
