import { Module } from '@nestjs/common';
import { StoryGenerationController } from './story-generation.controller';
import { StoryGenerationService } from './story-generation.service';
import { QueueService } from '../queue/queue.service';

@Module({

  controllers: [StoryGenerationController],
  providers: [StoryGenerationService,QueueService],
})
export class StoryGenerationModule {}
