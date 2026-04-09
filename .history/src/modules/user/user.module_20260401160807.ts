import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { ActivityModule } from '../activity/activity.module';
import { ActivityService } from '../activity/activity.service';

@Module({
  imports: [ActivityModule],
  controllers: [UserController],
  providers: [UserService,ActivityService],
  exports: [UserService],
})
export class UserModule {}
