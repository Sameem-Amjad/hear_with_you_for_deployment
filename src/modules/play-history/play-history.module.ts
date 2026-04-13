import { Module } from '@nestjs/common';
import { PlayHistoryController } from './play-history.controller';
import { PlayHistoryService } from './play-history.service';

@Module({
  controllers: [PlayHistoryController],
  providers: [PlayHistoryService],
  exports: [PlayHistoryService],
})
export class PlayHistoryModule {}
