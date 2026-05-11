import { Injectable } from '@nestjs/common';
import { StoryTheme } from '@prisma/client';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminManagementService } from './services/admin-management.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminCreditsService } from './services/admin-credits.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: AdminAuthService,
    private readonly dashboardService: AdminDashboardService,
    private readonly managementService: AdminManagementService,
    private readonly settingsService: AdminSettingsService,
    private readonly creditsService: AdminCreditsService,
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

  dashboardCombined(opts: { range?: string; from?: string; to?: string; page?: number; limit?: number }) {
    return this.dashboardService.dashboardCombined(opts);
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

  listTemplates(
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      isActive?: boolean;
      isPublished?: boolean;
    },
  ) {
    return this.managementService.listTemplates(page, limit, filters);
  }

  getTemplate(id: string) {
    return this.managementService.getTemplate(id);
  }

  createTemplate(dto: {
    name: string;
    templatePrompt: string;
    templateSvg?: string;
    isFeatured?: boolean;
    isPublished?: boolean;
    isActive?: boolean;
  }, templateSvgFile?: Express.Multer.File) {
    return this.managementService.createTemplate(dto, templateSvgFile);
  }

  updateTemplate(
    id: string,
    dto: {
      name?: string;
      templatePrompt?: string;
      templateSvg?: string;
      isFeatured?: boolean;
      isPublished?: boolean;
      isActive?: boolean;
    },
    templateSvgFile?: Express.Multer.File,
  ) {
    return this.managementService.updateTemplate(id, dto, templateSvgFile);
  }

  archiveTemplate(id: string) {
    return this.managementService.archiveTemplate(id);
  }

  publishTemplate(id: string) {
    return this.managementService.publishTemplate(id);
  }

  unpublishTemplate(id: string) {
    return this.managementService.unpublishTemplate(id);
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

  getProviderCreditsStatus() {
    return this.creditsService.getProviderCreditsStatus();
  }

  updateSubscriptionPlanSetting(
    code: string,
    dto: {
      displayName?: string;
      displayPrice?: number;
      currency?: string;
      billingPeriod?: string;
      storiesPerMonth?: number;
      voiceProfiles?: number;
      audioGenerationsPerMonth?: number;
      storeProductIds?: { ios?: string; android?: string };
      isActive?: boolean;
    },
  ) {
    return this.settingsService.updateSubscriptionPlanSetting(code, dto);
  }

  createSubscriptionPlan(dto: {
    displayName: string;
    displayPrice: number;
    billingPeriod?: string;
    currency?: string;
    storiesPerMonth?: number;
    voiceProfiles?: number;
    audioGenerationsPerMonth?: number;
    storeProductIds?: { ios?: string; android?: string };
    isActive?: boolean;
  }) {
    return this.settingsService.createSubscriptionPlan(dto);
  }

  updateSubscriptionPlanById(
    id: string,
    dto: {
      displayName?: string;
      displayPrice?: number;
      billingPeriod?: string;
      currency?: string;
      storiesPerMonth?: number;
      voiceProfiles?: number;
      audioGenerationsPerMonth?: number;
      storeProductIds?: { ios?: string; android?: string };
      isActive?: boolean;
    },
  ) {
    return this.settingsService.updateSubscriptionPlanById(id, dto);
  }

  deleteSubscriptionPlan(id: string) {
    return this.settingsService.deleteSubscriptionPlan(id);
  }

}

