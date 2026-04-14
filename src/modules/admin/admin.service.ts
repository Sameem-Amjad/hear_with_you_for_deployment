import { Injectable } from '@nestjs/common';
import { FeedbackType, Prisma, StoryTheme } from '@prisma/client';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminFeedbackService } from './services/admin-feedback.service';
import { AdminManagementService } from './services/admin-management.service';
import { AdminSettingsService } from './services/admin-settings.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly dashboardService: AdminDashboardService,
    private readonly managementService: AdminManagementService,
    private readonly settingsService: AdminSettingsService,
    private readonly feedbackService: AdminFeedbackService,
  ) {}

  login(dto: { email: string; password: string }) {
    return this.authService.login(dto);
  }

  createAdmin(
    dto: {
      name: string;
      email: string;
      password: string;
      profilePicture?: string;
    },
    setupKey?: string,
  ) {
    return this.authService.createAdmin(dto, setupKey);
  }

  overview() {
    return this.dashboardService.overview();
  }

  dashboardOverview(range: string) {
    return this.dashboardService.dashboardOverview(range);
  }

  dashboardRevenue(range: string) {
    return this.dashboardService.dashboardRevenue(range);
  }

  dashboardUserGrowth(range: string) {
    return this.dashboardService.dashboardUserGrowth(range);
  }

  dashboardRecentActivity(page = 1, limit = 20) {
    return this.dashboardService.dashboardRecentActivity(page, limit);
  }

  listUsers(
    page = 1,
    limit = 20,
    filters?: { search?: string; planCode?: string; status?: string },
  ) {
    return this.managementService.listUsers(page, limit, filters);
  }

  updateUserStatus(
    id: string,
    dto: { isActive: boolean; reason?: string },
  ) {
    return this.managementService.updateUserStatus(id, dto);
  }

  deleteUser(id: string) {
    return this.managementService.deleteUser(id);
  }

  listStories(
    page = 1,
    limit = 20,
    filters?: { search?: string; theme?: StoryTheme; from?: string; to?: string },
  ) {
    return this.managementService.listStories(page, limit, filters);
  }

  updateStoryFeature(id: string, isFeatured: boolean) {
    return this.managementService.updateStoryFeature(id, isFeatured);
  }

  listTemplates(page = 1, limit = 20) {
    return this.managementService.listTemplates(page, limit);
  }

  createTemplate(dto: {
    name: string;
    description?: string;
    theme: StoryTheme;
    ageGroup: any;
    promptTemplate: string;
    placeholders?: string[];
    tags?: string[];
    thumbnailUrl?: string;
    isFeatured?: boolean;
    isActive?: boolean;
  }) {
    return this.managementService.createTemplate(dto);
  }

  updateTemplate(id: string, dto: Prisma.StoryTemplateUpdateInput) {
    return this.managementService.updateTemplate(id, dto);
  }

  archiveTemplate(id: string) {
    return this.managementService.archiveTemplate(id);
  }

  subscriptionsOverview(range: string) {
    return this.managementService.subscriptionsOverview(range);
  }

  subscriptionTransactions(
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      planCode?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.managementService.subscriptionTransactions(page, limit, filters);
  }

  getProviderSettings() {
    return this.settingsService.getProviderSettings();
  }

  updateProviderKey(provider: string, apiKey: string) {
    return this.settingsService.updateProviderKey(provider, apiKey);
  }

  getSubscriptionPlanSettings() {
    return this.settingsService.getSubscriptionPlanSettings();
  }

  updateSubscriptionPlanSetting(
    code: string,
    dto: {
      displayName?: string;
      displayPrice?: number;
      currency?: string;
      storiesPerMonth?: number;
      voiceProfiles?: number;
      storeProductIds?: { ios?: string; android?: string };
      isActive?: boolean;
    },
  ) {
    return this.settingsService.updateSubscriptionPlanSetting(code, dto);
  }

  listFeedback(
    page = 1,
    limit = 20,
    filters?: { search?: string; type?: FeedbackType; status?: string },
  ) {
    return this.feedbackService.listFeedback(page, limit, filters);
  }

  respondFeedback(
    id: string,
    dto: { response: string; status: string },
    respondedBy: string,
  ) {
    return this.feedbackService.respondFeedback(id, dto, respondedBy);
  }
}
