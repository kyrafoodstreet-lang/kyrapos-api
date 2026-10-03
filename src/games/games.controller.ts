import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '@prisma/client';
import {
  CreateGameDto,
  UpdateGameDto,
  CreatePricingDto,
  UpdatePricingDto,
  CreateCustomerDto,
  CreateSessionDto,
  CreateCoinSaleDto,
  CloseSessionDto,
  CreatePaymentDto,
  ValidateOfferDto,
  CloseGameDayDto,
} from './dto/games.dto';

@Controller('games')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
export class GamesController {
  constructor(private readonly service: GamesService) {}

  // ==========================================
  // OFFERS / PROMOTIONS
  // ==========================================

  @Post('offers/validate')
  async validateOffer(@Body() dto: ValidateOfferDto) {
    return this.service.validateOffer(dto.code, dto.amount);
  }

  // ==========================================
  // 1. DASHBOARD
  // ==========================================

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.service.getDashboardStats();
  }

  // ==========================================
  // 2. GAME CATALOG
  // ==========================================

  @Get('catalog')
  async getGames() {
    return this.service.getGames();
  }

  @Post('catalog')
  @Roles(Role.ADMIN, Role.MANAGER)
  async createGame(@Body() dto: CreateGameDto) {
    return this.service.createGame(dto);
  }

  @Put('catalog/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updateGame(@Param('id') id: string, @Body() dto: UpdateGameDto) {
    return this.service.updateGame(id, dto);
  }

  @Delete('catalog/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async deleteGame(@Param('id') id: string) {
    return this.service.deleteGame(id);
  }

  // ==========================================
  // 3. PRICING PACKAGES
  // ==========================================

  @Get('pricing')
  async getPricings() {
    return this.service.getPricings();
  }

  @Post('pricing')
  @Roles(Role.ADMIN, Role.MANAGER)
  async createPricing(@Body() dto: CreatePricingDto) {
    return this.service.createPricing(dto);
  }

  @Put('pricing/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async updatePricing(@Param('id') id: string, @Body() dto: UpdatePricingDto) {
    return this.service.updatePricing(id, dto);
  }

  @Delete('pricing/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async deletePricing(@Param('id') id: string) {
    return this.service.deletePricing(id);
  }

  // ==========================================
  // 4. CUSTOMERS
  // ==========================================

  @Get('customers')
  async getCustomers() {
    return this.service.getCustomers();
  }

  @Get('customers/lookup')
  async lookupCustomer(@Query('mobile') mobile: string) {
    return this.service.lookupCustomerByMobile(mobile);
  }

  @Get('customers/search/:mobile')
  async searchCustomer(@Param('mobile') mobile: string) {
    return this.service.searchCustomer(mobile);
  }

  @Post('customers')
  async createCustomer(@Body() dto: CreateCustomerDto) {
    return this.service.createCustomer(dto);
  }

  // ==========================================
  // 5. GAME SESSIONS
  // ==========================================

  @Get('sessions/active')
  async getActiveSessions() {
    return this.service.getActiveSessions();
  }

  @Get('sessions/completed')
  async getCompletedSessions() {
    return this.service.getCompletedSessions();
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  @Post('sessions')
  async startSession(@CurrentUser() user: any, @Body() dto: CreateSessionDto) {
    return this.service.startSession(user.id, user.role, dto);
  }

  @Post('coin-sales')
  async sellCoins(@CurrentUser() user: any, @Body() dto: CreateCoinSaleDto) {
    return this.service.sellCoins(user.id, user.role, dto);
  }

  @Put('sessions/:id/close')
  async closeSession(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CloseSessionDto,
  ) {
    return this.service.closeSession(id, dto, user.id);
  }

  // ==========================================
  // 6. PAYMENTS LEDGER
  // ==========================================

  @Get('payments')
  async getPayments() {
    return this.service.getPayments();
  }

  @Post('sessions/:id/payments')
  async addPayment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.addPayment(id, { amount: dto.amount, method: dto.method, notes: dto.notes }, user.id);
  }

  // ==========================================
  // 7. REPORTS
  // ==========================================

  @Get('reports')
  async getReports(@Query('start') start: string, @Query('end') end: string) {
    return this.service.getReports(start, end);
  }

  // ==========================================
  // 8. DAY CLOSING & RECONCILIATION
  // ==========================================

  @Get('day-close/status')
  async getDayCloseStatus(@Query('date') date?: string) {
    return this.service.getDayCloseStatus(date);
  }

  @Post('day-close')
  async closeGameDay(@CurrentUser() user: any, @Body() dto: CloseGameDayDto) {
    return this.service.closeGameDay(user, dto);
  }

  @Get('day-close/history')
  async getDayCloseHistory() {
    return this.service.getDayCloseHistory();
  }
}

