import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { ActivityService } from './activity.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { API_PATHS } from '../../common/constants/api.paths';
import { SWAGGER_META } from '../../common/constants/swagger.meta';

@ApiTags(SWAGGER_META.TAGS.ACTIVITY)
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller(API_PATHS.ACTIVITY.USER_HISTORY_ROOT)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({
    summary: SWAGGER_META.ACTIVITY.GET_HISTORY.SUMMARY,
    description: SWAGGER_META.ACTIVITY.GET_HISTORY.DESCRIPTION,
  })
  async getActivityHistory(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    return this.activityService.getUserActivityHistory(
      user.id,
      Number(query.page ?? 1),
      Number(query.limit ?? 20),
    );
  }
}
