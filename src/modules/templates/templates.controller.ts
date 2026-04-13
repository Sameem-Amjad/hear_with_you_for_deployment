import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { ListTemplatesQueryDto } from './dto/list-templates-query.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Templates')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List story templates' })
  async list(@Query() query: ListTemplatesQueryDto) {
    const res = await this.templatesService.list(query);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page: res.page,
      limit: res.limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get story template' })
  get(@Param('id') id: string) {
    return this.templatesService.get(id);
  }
}
