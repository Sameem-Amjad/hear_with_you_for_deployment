import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('access')
  @ApiOperation({ summary: 'Redirect to a signed DigitalOcean Spaces URL' })
  async access(@Query('url') url: string, @Res() response: Response) {
    if (!url) {
      throw new BadRequestException('url is required');
    }

    const signedUrl = await this.storageService.resolveAccessibleUrl(url);
    return response.redirect(signedUrl);
  }
}