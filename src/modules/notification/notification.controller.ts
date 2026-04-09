import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { NotificationService } from './notification.service';

@ApiTags('Notification')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  list(@CurrentUser() user: { id: string }) {
    return this.notificationService.list(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notificationService.markRead(user.id, id);
  }
}
