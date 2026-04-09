import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@ApiTags('Admin')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin overview stats' })
  stats() {
    return this.adminService.overview();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users (admin)' })
  async users(@Query() query: PaginationQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.adminService.listUsers(page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }
}
