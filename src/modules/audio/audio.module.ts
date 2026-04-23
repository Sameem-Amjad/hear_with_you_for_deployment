import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AudioProcessorService } from './audio-processor.service';
import { VoiceProfileModule } from '../voice-profile/voice-profile.module';
import { AudioRecoveryService } from './audio-recovery.service';

@Module({
  imports: [VoiceProfileModule],
  controllers: [AudioController],
  providers: [AudioService, AudioProcessorService, AudioRecoveryService],
})
export class AudioModule {}
