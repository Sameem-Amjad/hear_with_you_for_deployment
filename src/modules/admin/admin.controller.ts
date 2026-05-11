import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { AdminStoriesQueryDto } from './dto/admin-stories-query.dto';
import { AdminTransactionsQueryDto } from './dto/admin-transactions-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';
import { FeatureStoryDto } from './dto/feature-story.dto';
import { RangeQueryDto } from './dto/range-query.dto';
import { AdminTemplatesQueryDto } from './dto/admin-templates-query.dto';
import { UpdateProviderKeyDto } from './dto/update-provider-key.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpsertTemplateDto } from './dto/upsert-template.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from '../../common/decorators/public.decorator';

const templateSvgUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
};

@ApiTags('Admin')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Admin login using email and password' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @Public()
  @Post('create')
  @ApiOperation({ summary: 'Bootstrap first admin with setup key' })
  createAdmin(
    @Body() dto: CreateAdminDto,
    @Headers('x-admin-setup-key') setupKey?: string,
  ) {
    return this.adminService.createAdmin(dto, setupKey);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Admin overview stats' })
  stats() {
    return this.adminService.overview();
  }

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Dashboard overview with growth deltas' })
  dashboardOverview(@Query() query: RangeQueryDto) {
    return this.adminService.dashboardOverview(query.range ?? '30d');
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Combined dashboard endpoint with KPIs, series and recent activity' })
  async dashboard(@Query() query: AdminDashboardQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    return this.adminService.dashboardCombined({
      range: query.range,
      from: query.from,
      to: query.to,
      page,
      limit,
    });
  }

  @Get('dashboard/revenue')
  @ApiOperation({ summary: 'Revenue series for dashboard chart' })
  dashboardRevenue(@Query() query: RangeQueryDto) {
    return this.adminService.dashboardRevenue(query.range ?? '30d');
  }

  @Get('dashboard/user-growth')
  @ApiOperation({ summary: 'User growth series for dashboard chart' })
  dashboardUserGrowth(@Query() query: RangeQueryDto) {
    return this.adminService.dashboardUserGrowth(query.range ?? '30d');
  }

  @Get('dashboard/recent-activity')
  @ApiOperation({ summary: 'Recent activity feed with pagination' })
  async dashboardRecentActivity(@Query() query: PaginationQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.adminService.dashboardRecentActivity(page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get('users')
  @ApiOperation({ summary: 'List users (admin)' })
  async users(@Query() query: AdminUsersQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.adminService.listUsers(page, limit, query);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Enable or disable user' })
  updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft delete user' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('stories')
  @ApiOperation({ summary: 'Admin story listing with filters and summary' })
  async stories(@Query() query: AdminStoriesQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.adminService.listStories(page, limit, query);
    return {
      ...buildPaginatedResponse({
        items: res.items,
        total: res.total,
        page,
        limit,
      }),
      summary: res.summary,
    };
  }

  @Patch('stories/:id/feature')
  @ApiOperation({ summary: 'Mark story featured/unfeatured' })
  updateStoryFeature(@Param('id') id: string, @Body() dto: FeatureStoryDto) {
    return this.adminService.updateStoryFeature(id, dto.isFeatured);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Admin template list with search and filters' })
  async templates(@Query() query: AdminTemplatesQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.adminService.listTemplates(page, limit, query);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template details' })
  getTemplate(@Param('id') id: string) {
    return this.adminService.getTemplate(id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create story template' })
  @UseInterceptors(FileInterceptor('templateSvgFile', templateSvgUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpsertTemplateDto })
  createTemplate(
    @Body() dto: UpsertTemplateDto,
    @UploadedFile() templateSvgFile?: Express.Multer.File,
  ) {
    return this.adminService.createTemplate(dto, templateSvgFile);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update story template' })
  @UseInterceptors(FileInterceptor('templateSvgFile', templateSvgUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateTemplateDto })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @UploadedFile() templateSvgFile?: Express.Multer.File,
  ) {
    return this.adminService.updateTemplate(id, dto, templateSvgFile);
  }

  @Patch('templates/:id/publish')
  @ApiOperation({ summary: 'Publish story template' })
  publishTemplate(@Param('id') id: string) {
    return this.adminService.publishTemplate(id);
  }

  @Patch('templates/:id/unpublish')
  @ApiOperation({ summary: 'Unpublish story template' })
  unpublishTemplate(@Param('id') id: string) {
    return this.adminService.unpublishTemplate(id);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Archive template' })
  deleteTemplate(@Param('id') id: string) {
    return this.adminService.archiveTemplate(id);
  }

  @Get('subscriptions/overview')
  @ApiOperation({ summary: 'Subscription overview and plan distribution' })
  subscriptionsOverview(@Query() query: RangeQueryDto) {
    return this.adminService.subscriptionsOverview(query.range ?? '30d');
  }

  @Get('subscriptions/transactions')
  @ApiOperation({ summary: 'Subscription/payment transactions list' })
  async subscriptionTransactions(@Query() query: AdminTransactionsQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.adminService.subscriptionTransactions(
      page,
      limit,
      query,
    );
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get('settings/providers')
  @ApiOperation({ summary: 'Provider key status list' })
  settingsProviders() {
    return this.adminService.getProviderSettings();
  }

  @Get('settings/provider-credits')
  @ApiOperation({
    summary: 'Live credit/quota status for ElevenLabs and OpenAI',
    description:
      'Fetches remaining characters, voice slots, and billing info from ElevenLabs and OpenAI in real time using the stored API keys.',
  })
  getProviderCreditsStatus() {
    return this.adminService.getProviderCreditsStatus();
  }

  @Patch('settings/providers/:provider')
  @ApiOperation({ summary: 'Rotate provider API key' })
  updateProviderKey(
    @Param('provider') provider: string,
    @Body() dto: UpdateProviderKeyDto,
  ) {
    return this.adminService.updateProviderKey(provider, dto.apiKey);
  }

  @Get('settings/subscription-plans')
  @ApiOperation({ summary: 'Get all subscription plans' })
  getSubscriptionPlans() {
    return this.adminService.getSubscriptionPlanSettings();
  }

  @Post('subscription-plans')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.adminService.createSubscriptionPlan(dto);
  }

  @Patch('subscription-plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan by ID' })
  updateSubscriptionPlanById(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.adminService.updateSubscriptionPlanById(id, dto);
  }

  @Delete('subscription-plans/:id')
  @ApiOperation({ summary: 'Deactivate a subscription plan by ID' })
  deleteSubscriptionPlan(@Param('id') id: string) {
    return this.adminService.deleteSubscriptionPlan(id);
  }

  @Patch('settings/subscription-plans/:code')
  @ApiOperation({ summary: 'Update subscription plan by code (legacy)' })
  updateSubscriptionPlan(
    @Param('code') code: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.adminService.updateSubscriptionPlanSetting(code, dto);
  }
}
