import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PartyHallService } from './party-hall.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '@prisma/client';
import {
  CreateHallDto,
  UpdateHallDto,
  CreateBookingDto,
  UpdateBookingStatusDto,
  CreatePaymentDto,
} from './dto/party-hall.dto';

@Controller('party-hall')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class PartyHallController {
  constructor(private readonly service: PartyHallService) {}

  // ==========================================
  // 1. DASHBOARD
  // ==========================================

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.service.getDashboardStats();
  }

  // ==========================================
  // 2. HALLS
  // ==========================================

  @Get('halls')
  async getHalls() {
    return this.service.getHalls();
  }

  @Post('halls')
  @Roles(Role.ADMIN)
  async createHall(@Body() dto: CreateHallDto) {
    return this.service.createHall(dto);
  }

  @Put('halls/:id')
  async updateHall(@Param('id') id: string, @Body() dto: UpdateHallDto) {
    return this.service.updateHall(id, dto);
  }

  @Delete('halls/:id')
  @Roles(Role.ADMIN)
  async deleteHall(@Param('id') id: string) {
    return this.service.deleteHall(id);
  }

  // ==========================================
  // 3. BOOKINGS
  // ==========================================

  @Get('bookings')
  async getBookings() {
    return this.service.getBookings();
  }

  @Get('bookings/:id')
  async getBooking(@Param('id') id: string) {
    return this.service.getBooking(id);
  }

  @Post('bookings')
  async createBooking(@CurrentUser() user: any, @Body() dto: CreateBookingDto) {
    return this.service.createBooking(user.id, dto);
  }

  @Put('bookings/:id')
  async updateBooking(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: CreateBookingDto) {
    return this.service.updateBooking(id, dto, user.id);
  }

  @Put('bookings/:id/status')
  async updateBookingStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.service.updateBookingStatus(id, dto, user.id);
  }

  // ==========================================
  // 4. PAYMENTS & INVOICES
  // ==========================================

  @Get('payments')
  async getPayments() {
    return this.service.getPayments();
  }

  @Get('bookings/:id/payments')
  async getPaymentsForBooking(@Param('id') id: string) {
    return this.service.getPaymentsForBooking(id);
  }

  @Post('bookings/:id/payments')
  async addPayment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.addPayment(id, dto, user.id);
  }

  @Get('invoices')
  async getInvoices() {
    return this.service.getInvoices();
  }

  @Get('bookings/:id/invoices')
  async getInvoicesForBooking(@Param('id') id: string) {
    return this.service.getInvoicesForBooking(id);
  }

  @Post('bookings/:id/invoices')
  async createInvoice(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.createInvoice(id, user.id);
  }

  // ==========================================
  // 5. CUSTOMERS
  // ==========================================

  @Get('customers')
  async getCustomers() {
    return this.service.getCustomers();
  }

  // ==========================================
  // 6. REPORTS
  // ==========================================

  @Get('reports')
  async getReports(@Query('start') start: string, @Query('end') end: string) {
    return this.service.getReports(start, end);
  }
}
