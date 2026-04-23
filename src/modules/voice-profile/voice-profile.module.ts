import { Module } from '@nestjs/common';
import { VoiceProfileController } from './voice-profile.controller';
import { VoiceProfileService } from './voice-profile.service';
import { ElevenLabsService } from './elevenlabs.service';
import { ProviderCredentialsModule } from '../provider-credentials/provider-credentials.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [ProviderCredentialsModule],
  controllers: [VoiceProfileController],
  providers: [VoiceProfileService, ElevenLabsService, AdminGuard],
  exports: [VoiceProfileService, ElevenLabsService],
})
export class VoiceProfileModule {}
