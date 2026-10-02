import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { PublicBookingController } from './public-booking.controller';

@Module({
  providers: [GamesService],
  controllers: [GamesController, PublicBookingController],
  exports: [GamesService],
})
export class GamesModule {}
