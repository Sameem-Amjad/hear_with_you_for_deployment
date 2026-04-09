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
    await this.queueService.markProcessing(String(job.id));
    try {
      this.logger.log(`Processing cleanup job ${job.name} id=${job.id}`);
      const result = { ok: true, name: job.name };
      await this.queueService.markCompleted(String(job.id), result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.queueService.markFailed(String(job.id), message);
      throw err;
    }
  }
}
