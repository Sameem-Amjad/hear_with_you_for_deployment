import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto';
import { CompleteUploadVoiceProfileDto } from './dto/complete-upload-voice-profile.dto';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { VoiceProfileService } from './voice-profile.service';
import { StorageService } from '../storage/storage.service';

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
};

@ApiTags('VoiceProfile')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('voice-profiles')
export class VoiceProfileController {
  constructor(
    private readonly voiceProfileService: VoiceProfileService,
    private readonly storageService: StorageService,
  ) {}

  private async wrapUrl(url?: string | null): Promise<string | null> {
    if (!url) {
      return url ?? null;
    }

    return this.storageService.resolveAccessibleUrl(url);
  }

  private async wrapVoiceProfile(voiceProfile: any) {
    const wrappedUrls = await Promise.all(
      (Array.isArray(voiceProfile.sampleAudioUrls)
        ? voiceProfile.sampleAudioUrls
        : []
      ).map((url: string) => this.storageService.resolveAccessibleUrl(url)),
    );

    return {
      ...voiceProfile,
      sampleAudioUrls: wrappedUrls,
    };
  }

  private async wrapUploadSession(uploadSession: any) {
    if (!uploadSession?.publicUrl) {
      return uploadSession;
    }

    return {
      ...uploadSession,
      publicUrl: await this.wrapUrl(uploadSession.publicUrl),
    };
  }

  @Post()
  @UseInterceptors(FilesInterceptor('samples', 5, multerOptions))
  @ApiOperation({ summary: 'Create voice profile (clone)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateVoiceProfileDto })
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateVoiceProfileDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() request: Request,
  ) {
    const res = await this.voiceProfileService.createWithSamples(
      user.id,
      dto,
      files,
    );

    return {
      ...res,
      voiceProfile: await this.wrapVoiceProfile(res.voiceProfile),
    };
  }

  @Post('upload-sessions')
  @ApiOperation({ summary: 'Create DigitalOcean Spaces presigned upload URL' })
  async createUploadSession(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateUploadSessionDto,
    @Req() request: Request,
  ) {
    const res = await this.voiceProfileService.createUploadSession(user.id, dto);

    return {
      ...res,
      uploadSession: await this.wrapUploadSession(res.uploadSession),
    };
  }

  @Post('complete-upload')
  @ApiOperation({ summary: 'Create voice profile from uploaded sample object keys' })
  async completeUpload(
    @CurrentUser() user: { id: string },
    @Body() dto: CompleteUploadVoiceProfileDto,
    @Req() request: Request,
  ) {
    const res = await this.voiceProfileService.createWithUploadedKeys(
      user.id,
      dto,
    );

    return {
      ...res,
      voiceProfile: await this.wrapVoiceProfile(res.voiceProfile),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List voice profiles' })
  async list(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
    @Req() request: Request,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.voiceProfileService.list(user.id, page, limit);

    const items = await Promise.all( res.items.map((item) =>
      this.wrapUrl(item.sampleAudioUrl).then((url) => ({
        ...item,
        sampleAudioUrl: url,
      })),
    ));

    return buildPaginatedResponse({
      items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get voice profile' })
  async get(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const res = await this.voiceProfileService.get(user.id, id);
    return {
      voiceProfile: await this.wrapVoiceProfile(res.voiceProfile),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update voice profile' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateVoiceProfileDto,
    @Req() request: Request,
  ) {
    const res = await this.voiceProfileService.update(user.id, id, dto);
    return {
      ...res,
      voiceProfile: await this.wrapVoiceProfile(res.voiceProfile),
    };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete voice profile' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.voiceProfileService.remove(user.id, id);
  }
}
