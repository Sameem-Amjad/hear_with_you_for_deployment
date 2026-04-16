import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { AudioService } from './audio.service';
import { GenerateAudioDto } from './dto/generate-audio.dto';
import { StorageService } from '../storage/storage.service';

@ApiTags('Audio')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('audio')
export class AudioController {
  constructor(
    private readonly audioService: AudioService,
    private readonly storageService: StorageService,
  ) {}

  private async wrapUrl(url?: string | null): Promise<string | null> {
    if (!url) {
      return url ?? null;
    }

    return this.storageService.resolveAccessibleUrl(url);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate audio for story' })
  async generate(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateAudioDto,
    @Req() request: Request,
  ) {
    const res = await this.audioService.generateForStory({
      userId: user.id,
      storyId: dto.storyId,
      voiceProfileId: dto.voiceProfileId,
    });

    return {
      ...res,
      story: {
        ...res.story,
        audioUrl: await this.wrapUrl(res.story.audioUrl),
      },
    };
  }
}
