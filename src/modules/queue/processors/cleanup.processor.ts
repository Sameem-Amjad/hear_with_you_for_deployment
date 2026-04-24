import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueueService } from '../queue.service';
import { QUEUE_NAMES } from '../queue.constants';

@Processor(QUEUE_NAMES.CLEANUP)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly queueService: QueueService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const queueJobId = (job.data as { queueJobId?: string }).queueJobId;
    await this.queueService.markProcessing(
      QUEUE_NAMES.CLEANUP,
      String(job.id),
      queueJobId,
    );
    try {
      this.logger.log(`Processing cleanup job ${job.name} id=${job.id}`);
      const result = { ok: true, name: job.name };
      await this.queueService.markCompleted(
        QUEUE_NAMES.CLEANUP,
        String(job.id),
        result,
        queueJobId,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.queueService.markFailed(
        QUEUE_NAMES.CLEANUP,
        String(job.id),
        message,
        queueJobId,
      );
      throw err;
    }
  }
}
