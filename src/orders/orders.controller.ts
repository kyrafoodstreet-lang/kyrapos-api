import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, CompletePaymentDto, CancelOrderDto } from './dto/orders.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get()
  async findAllActive() {
    return this.ordersService.findAllActive();
  }

  @Get('held')
  async getHeldOrders() {
    return this.ordersService.getHeldOrders();
  }

  @Get('history')
  async getSalesHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ordersService.getSalesHistory(startDate, endDate);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/hold')
  async holdOrder(@Param('id') id: string) {
    return this.ordersService.holdOrder(id);
  }

  @Post(':id/resume')
  async resumeOrder(@Param('id') id: string) {
    return this.ordersService.resumeOrder(id);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Post(':id/payment')
  async completePayment(@Param('id') id: string, @Body() dto: CompletePaymentDto) {
    return this.ordersService.completePayment(id, dto);
  }

  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(id, user.name, dto.reason);
  }

  @Get('customer/search/:phone')
  async searchCustomer(@Param('phone') phone: string) {
    return this.ordersService.searchCustomer(phone);
  }

  @Get('customer/suggestions/:prefix')
  async getCustomerSuggestions(@Param('prefix') prefix: string) {
    return this.ordersService.getCustomerSuggestions(prefix);
  }
}
