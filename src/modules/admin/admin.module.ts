import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminManagementService } from './services/admin-management.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminCreditsService } from './services/admin-credits.service';

@Module({
  imports: [ProviderCredentialsModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminGuard,
    AdminAuthService,
    AdminDashboardService,
    AdminManagementService,
    AdminSettingsService,
    AdminCreditsService,
  ],
})
export class AdminModule {}
