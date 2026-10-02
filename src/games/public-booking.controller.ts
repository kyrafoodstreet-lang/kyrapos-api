import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { GamesService } from './games.service';
import { CreatePublicBookingDto } from './dto/games.dto';

@Controller('public/games')
export class PublicBookingController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('catalog')
  async getCatalog() {
    return this.gamesService.getPublicCatalog();
  }

  @Post('book')
  async createBooking(@Body() dto: CreatePublicBookingDto) {
    return this.gamesService.createPublicBooking(dto);
  }
}
