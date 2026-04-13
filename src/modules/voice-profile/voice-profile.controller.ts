import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto';
import { CompleteUploadVoiceProfileDto } from './dto/complete-upload-voice-profile.dto';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { VoiceProfileService } from './voice-profile.service';

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
};

@ApiTags('VoiceProfile')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('voice-profiles')
export class VoiceProfileController {
  constructor(private readonly voiceProfileService: VoiceProfileService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('samples', 5, multerOptions))
  @ApiOperation({ summary: 'Create voice profile (clone)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateVoiceProfileDto })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateVoiceProfileDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.voiceProfileService.createWithSamples(user.id, dto, files);
  }

  @Post('upload-sessions')
  @ApiOperation({ summary: 'Create DigitalOcean Spaces presigned upload URL' })
  createUploadSession(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateUploadSessionDto,
  ) {
    return this.voiceProfileService.createUploadSession(user.id, dto);
  }

  @Post('complete-upload')
  @ApiOperation({ summary: 'Create voice profile from uploaded sample object keys' })
  completeUpload(
    @CurrentUser() user: { id: string },
    @Body() dto: CompleteUploadVoiceProfileDto,
  ) {
    return this.voiceProfileService.createWithUploadedKeys(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List voice profiles' })
  async list(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationQueryDto,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const res = await this.voiceProfileService.list(user.id, page, limit);
    return buildPaginatedResponse({
      items: res.items,
      total: res.total,
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get voice profile' })
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.voiceProfileService.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update voice profile' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateVoiceProfileDto,
  ) {
    return this.voiceProfileService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete voice profile' })
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.voiceProfileService.remove(user.id, id);
  }
}
