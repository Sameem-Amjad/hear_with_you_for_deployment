import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { API_PATHS } from '../../common/constants/api.paths';
import { SWAGGER_META } from '../../common/constants/swagger.meta';
import { StoryGenerationService } from './story-generation.service';
import { GenerateStoryDto } from '../story/dto/generate-story.dto';

@ApiTags(SWAGGER_META.TAGS.STORY)
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller(API_PATHS.STORIES.ROOT)
export class StoryGenerationController {
  constructor(
    private readonly storyGenerationService: StoryGenerationService,
  ) {}

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
  status(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.storyGenerationService.getStatus(user.id, id);
  }
}
