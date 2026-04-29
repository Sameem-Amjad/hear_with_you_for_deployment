import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { NotificationService } from './notification.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('Notification')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  async list(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.notificationService.list(user.id, page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notificationService.markRead(user.id, id);
  }

  @Post('tokens')
  @ApiOperation({ summary: 'Register an FCM push token' })
  registerPushToken(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationService.registerPushToken(user.id, dto);
  }

  @Delete('tokens')
  @ApiOperation({ summary: 'Remove an FCM push token' })
  removePushToken(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationService.removePushToken(user.id, dto.token);
  }
}
