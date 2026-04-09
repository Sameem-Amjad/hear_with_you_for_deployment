import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueueService } from '../queue.service';
import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import { StoryService } from '../../story/story.service';
import { AudioService } from '../../audio/audio.service';
import { GenerateStoryDto } from '../../story/dto/generate-story.dto';

@Processor(QUEUE_NAMES.STORY_GENERATION)
export class StoryProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly storyService: StoryService,
    private readonly audioService: AudioService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    await this.queueService.markProcessing(String(job.id));
    try {
      this.logger.log(`Processing story job ${job.name} id=${job.id}`);
      const data = job.data as {
        userId: string;
        storyDto: GenerateStoryDto;
        generateAudio?: boolean;
        voiceProfileId?: string;
      };

      if (job.name === QUEUE_JOB_NAMES.STORY_GENERATE_TEXT) {
        const res = await this.storyService.generate(
          data.userId,
          data.storyDto,
        );
        const result = { storyId: res.story.id };
        await this.queueService.markCompleted(String(job.id), result);
        return result;
      }

      if (job.name === QUEUE_JOB_NAMES.STORY_FULL_PIPELINE) {
        const res = await this.storyService.generate(
          data.userId,
          data.storyDto,
        );
        if (data.generateAudio !== false) {
          await this.audioService.generateForStory({
            userId: data.userId,
            storyId: res.story.id,
            voiceProfileId: data.voiceProfileId,
          });
        }
        const result = {
          storyId: res.story.id,
          audioRequested: data.generateAudio !== false,
        };
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
