import { Module } from '@nestjs/common';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { StoryPromptService } from './story-prompt.service';
import { OpenAiService } from './openai.service';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module';

@Module({
  imports: [ProviderCredentialsModule],
  controllers: [StoryController],
  providers: [StoryService, StoryPromptService, OpenAiService],
  exports: [StoryService],
})
export class StoryModule {}
