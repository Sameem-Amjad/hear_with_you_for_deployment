import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { StoryService } from './story.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { SWAGGER_META } from '../../common/constants/swagger.meta';
import { API_PATHS } from '../../common/constants/api.paths';

@ApiTags(SWAGGER_META.TAGS.STORY)
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller(API_PATHS.STORIES.ROOT)
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({
    summary: SWAGGER_META.STORY.LIST.SUMMARY,
    description: SWAGGER_META.STORY.LIST.DESCRIPTION,
  })
  async list(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.storyService.list(user.id, page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorite stories' })
  async favorites(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.storyService.listFavorites(user.id, page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get('recent')
  @ApiOperation({ summary: 'List recently played stories' })
  async recent(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.storyService.listRecent(user.id, page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: SWAGGER_META.STORY.GET_ONE.SUMMARY,
    description: SWAGGER_META.STORY.GET_ONE.DESCRIPTION,
  })
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.storyService.get(user.id, id);
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Add story to favorites' })
  addFavorite(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.storyService.addFavorite(user.id, id);
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Remove story from favorites' })
  removeFavorite(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.storyService.removeFavorite(user.id, id);
  }
}
