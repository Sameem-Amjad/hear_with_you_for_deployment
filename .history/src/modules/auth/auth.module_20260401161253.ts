import { Module } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { ActivityModule } from '../activity/activity.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [ActivityModule],
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard]
})
export class AuthModule {}
