import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
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

  @Get()
  @ApiOperation({ summary: 'List voice profiles' })
  list(@CurrentUser() user: { id: string }) {
    return this.voiceProfileService.list(user.id);
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
