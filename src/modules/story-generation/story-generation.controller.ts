import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { API_PATHS } from '../../common/constants/api.paths';
import { SWAGGER_META } from '../../common/constants/swagger.meta';
import { StoryGenerationService } from './story-generation.service';
import { GenerateStoryDto } from '../story/dto/generate-story.dto';
import { StorageService } from '../storage/storage.service';

@ApiTags(SWAGGER_META.TAGS.STORY)
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller(API_PATHS.STORIES.ROOT)
export class StoryGenerationController {
  constructor(
    private readonly storyGenerationService: StoryGenerationService,
    private readonly storageService: StorageService,
  ) {}

  private async wrapUrl(url?: string | null): Promise<string | null> {
    if (!url) {
      return url ?? null;
    }

    return this.storageService.resolveAccessibleUrl(url);
  }

  @Post(API_PATHS.STORIES.GENERATE)
  @ApiOperation({
    summary: 'Generate and save story text only',
    description:
      'Generates story text from prompt and saves it. Use /audio/generate as a second step to create audio with a selected voice.',
  })
  async enqueue(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateStoryDto,
  ) {
    const res = await this.storyGenerationService.enqueueStoryText(user.id, dto);
    return {
      message: 'Story text generation queued',
      queueJobId: res.queueJobId,
      jobId: String(res.job.id),
    };
  }

  @Get(API_PATHS.STORIES.STATUS)
  @ApiOperation({ summary: 'Get story pipeline status' })
  async status(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const res = await this.storyGenerationService.getStatus(user.id, id);
    return {
      ...res,
      story: {
        ...res.story,
        audioUrl: await this.wrapUrl(res.story.audioUrl),
      },
    };
  }

  @Get('jobs/:queueJobId')
  @ApiOperation({ summary: 'Get story generation queue job status' })
  jobStatus(
    @CurrentUser() user: { id: string },
    @Param('queueJobId') queueJobId: string,
  ) {
    return this.storyGenerationService.getJobStatus(user.id, queueJobId);
  }
}
