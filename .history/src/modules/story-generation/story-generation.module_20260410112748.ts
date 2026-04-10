import { Module } from '@nestjs/common';
import { StoryGenerationController } from './story-generation.controller';
import { StoryGenerationService } from './story-generation.service';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [QueueModule, PrismaModule],
  controllers: [StoryGenerationController],
  providers: [StoryGenerationService],
})
export class StoryGenerationModule {}
