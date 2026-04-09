import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { AudioService } from './audio.service';
import { GenerateAudioDto } from './dto/generate-audio.dto';

@ApiTags('Audio')
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate audio for story' })
  generate(@CurrentUser() user: { id: string }, @Body() dto: GenerateAudioDto) {
    return this.audioService.generateForStory({
      userId: user.id,
      storyId: dto.storyId,
      voiceProfileId: dto.voiceProfileId,
    });
  }
}
