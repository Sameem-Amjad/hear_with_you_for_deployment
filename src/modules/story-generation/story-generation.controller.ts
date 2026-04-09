import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { API_PATHS } from '../../common/constants/api.paths';
import { SWAGGER_META } from '../../common/constants/swagger.meta';
import { StoryGenerationService } from './story-generation.service';
import { FullStoryRequestDto } from './dto/full-story-request.dto';

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
    summary: SWAGGER_META.STORY.GENERATE.SUMMARY,
    description: SWAGGER_META.STORY.GENERATE.DESCRIPTION,
  })
  async enqueue(
    @CurrentUser() user: { id: string },
    @Body() dto: FullStoryRequestDto,
  ) {
    const res = await this.storyGenerationService.enqueueFullPipeline(
      user.id,
      dto,
    );
    return {
      message: 'Story generation queued',
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
