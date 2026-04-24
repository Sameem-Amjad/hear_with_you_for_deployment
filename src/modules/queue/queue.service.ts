import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { JobStatus, JobType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  private buildStoredJobId(
    queueName: string,
    jobId: string,
    queueJobId?: string,
  ): string {
    return queueJobId
      ? `${queueName}:${jobId}:${queueJobId}`
      : `${queueName}:${jobId}`;
  }

  private getJobIdVariants(queueName: string, jobId: string): string[] {
    return [this.buildStoredJobId(queueName, jobId), jobId];
  }

  private getJobIdPrefix(queueName: string, jobId: string): string {
    return `${queueName}:${jobId}:`;
  }

  private extractRawJobId(jobId: string): string {
    const parts = jobId.split(':');
    if (parts.length >= 3) {
      return parts[parts.length - 2];
    }
    return parts.length > 1 ? parts[parts.length - 1] : jobId;
  }

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

    const payloadWithQueueJobId =
      typeof params.payload === 'object' &&
      params.payload !== null &&
      !Array.isArray(params.payload)
        ? ({
            ...(params.payload as Record<string, unknown>),
            queueJobId: created.id,
          } as Prisma.InputJsonValue)
        : params.payload;

    const job = await queue.add(params.name, payloadWithQueueJobId, {
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
      data: {
        payload: payloadWithQueueJobId,
        jobId: this.buildStoredJobId(params.queue, String(job.id), created.id),
      },
    });

    this.logger.log(
      `Enqueued ${params.queue}:${params.name} jobId=${job.id} queueJobId=${created.id}`,
    );

    return { job, queueJobId: created.id };
  }

  async markProcessing(
    queueName: string,
    jobId: string,
    queueJobId?: string,
  ): Promise<void> {
    await this.prismaService.queueJob.updateMany({
      where: {
        OR: [
          ...(queueJobId ? [{ id: queueJobId }] : []),
          {
            jobId: {
              in: this.getJobIdVariants(queueName, jobId),
            },
          },
          {
            jobId: {
              startsWith: this.getJobIdPrefix(queueName, jobId),
            },
          },
        ],
      },
      data: { status: JobStatus.PROCESSING, startedAt: new Date() },
    });
  }

  async markCompleted(
    queueName: string,
    jobId: string,
    result?: Prisma.InputJsonValue,
    queueJobId?: string,
  ): Promise<void> {
    await this.prismaService.queueJob.updateMany({
      where: {
        OR: [
          ...(queueJobId ? [{ id: queueJobId }] : []),
          {
            jobId: {
              in: this.getJobIdVariants(queueName, jobId),
            },
          },
          {
            jobId: {
              startsWith: this.getJobIdPrefix(queueName, jobId),
            },
          },
        ],
      },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        result: result ?? undefined,
      },
    });
  }

  async markFailed(
    queueName: string,
    jobId: string,
    error: string,
    queueJobId?: string,
  ): Promise<void> {
    await this.prismaService.queueJob.updateMany({
      where: {
        OR: [
          ...(queueJobId ? [{ id: queueJobId }] : []),
          {
            jobId: {
              in: this.getJobIdVariants(queueName, jobId),
            },
          },
          {
            jobId: {
              startsWith: this.getJobIdPrefix(queueName, jobId),
            },
          },
        ],
      },
      data: { status: JobStatus.FAILED, failedAt: new Date(), error },
    });
  }

  async cancelJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const rawJobId = this.extractRawJobId(jobId);
    const job = await queue.getJob(rawJobId);
    if (job) {
      await job.remove();
    }
    await this.prismaService.queueJob.updateMany({
      where: {
        jobId: {
          in: this.getJobIdVariants(queueName, rawJobId),
        },
      },
      data: { status: JobStatus.CANCELLED },
    });
  }
}
