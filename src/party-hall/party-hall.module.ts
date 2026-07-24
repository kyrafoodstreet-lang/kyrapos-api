import { Module } from '@nestjs/common';
import { PartyHallService } from './party-hall.service';
import { PartyHallController } from './party-hall.controller';

@Module({
  providers: [PartyHallService],
  controllers: [PartyHallController],
  exports: [PartyHallService],
})
export class PartyHallModule {}
