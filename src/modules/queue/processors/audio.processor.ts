import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueueService } from '../queue.service';
import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import { AudioService } from '../../audio/audio.service';

@Processor(QUEUE_NAMES.AUDIO_GENERATION)
export class AudioProcessor extends WorkerHost {
  private readonly logger = new Logger(AudioProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly audioService: AudioService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    await this.queueService.markProcessing(String(job.id));
    try {
      this.logger.log(`Processing audio job ${job.name} id=${job.id}`);
      const data = job.data as {
        userId: string;
        storyId: string;
        voiceProfileId?: string;
      };

      if (job.name === QUEUE_JOB_NAMES.AUDIO_GENERATE) {
        await this.audioService.generateForStory({
          userId: data.userId,
          storyId: data.storyId,
          voiceProfileId: data.voiceProfileId,
        });
        const result = { storyId: data.storyId };
        await this.queueService.markCompleted(String(job.id), result);
        return result;
      }

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
