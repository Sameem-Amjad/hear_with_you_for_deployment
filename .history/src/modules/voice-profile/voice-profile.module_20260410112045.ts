import { Module } from '@nestjs/common';
import { VoiceProfileController } from './voice-profile.controller';
import { VoiceProfileService } from './voice-profile.service';
import { ElevenLabsService } from './elevenlabs.service';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module';

@Module({
  imports: [ProviderCredentialsModule],
  controllers: [VoiceProfileController],
  providers: [VoiceProfileService, ElevenLabsService],
  exports: [VoiceProfileService, ElevenLabsService],
})
export class VoiceProfileModule {}
