import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { AudioService } from './audio.service';
import { AudioProcessorService } from './audio-processor.service';

@Module({
  controllers: [AudioController],
  providers: [AudioService, AudioProcessorService],
})
export class AudioModule {}
