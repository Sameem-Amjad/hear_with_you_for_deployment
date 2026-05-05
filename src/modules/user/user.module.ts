import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { ActivityModule } from '../activity/activity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [ActivityModule, PrismaModule, StorageModule, FirebaseModule],
  controllers: [UserController],
  providers: [UserService, AdminGuard],
  exports: [UserService],
})
export class UserModule {}
