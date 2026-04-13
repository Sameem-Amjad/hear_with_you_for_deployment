import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { UpsertPlayHistoryDto } from './dto/upsert-play-history.dto';
import { PlayHistoryService } from './play-history.service';

@ApiTags('PlayHistory')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('play-history')
export class PlayHistoryController {
  constructor(private readonly playHistoryService: PlayHistoryService) {}

  @Post()
  @ApiOperation({ summary: 'Save playback progress' })
  save(@CurrentUser() user: { id: string }, @Body() dto: UpsertPlayHistoryDto) {
    return this.playHistoryService.saveProgress(user.id, dto);
  }

  @Get('continue-listening')
  @ApiOperation({ summary: 'List continue listening items' })
  async continueListening(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.playHistoryService.listContinueListening(
      user.id,
      page,
      limit,
    );

    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }
}
