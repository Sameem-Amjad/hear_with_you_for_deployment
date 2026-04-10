import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { StoryProcessor } from './processors/story.processor';
import { AudioProcessor } from './processors/audio.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { QUEUE_NAMES } from './queue.constants';
import { StoryModule } from '../story/story.module';
import { AudioModule } from '../audio/audio.module';
import { AudioService } from '../audio/audio.service';

@Module({
  imports: [
    StoryModule,
    AudioModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: Number(configService.get<number>('REDIS_PORT', 6379)),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STORY_GENERATION },
      { name: QUEUE_NAMES.AUDIO_GENERATION },
      { name: QUEUE_NAMES.CLEANUP },
    ),
  ],
  providers: [QueueService, StoryProcessor, AudioProcessor, CleanupProcessor,AudioService],
  exports: [QueueService],
})
export class QueueModule {}
