import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('employee-summary')
  async getEmployeeSummary(@CurrentUser() user: any) {
    return this.reportsService.getEmployeeSummary(user.id);
  }

  @Get('executive-summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getExecutiveSummary() {
    return this.reportsService.getExecutiveSummary();
  }

  @Get('sales')
  async getSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : this.getDefaultStartDate();
    const end = this.getEndOfDay(endDate);
    return this.reportsService.getSalesReport(start, end);
  }

  @Get('items')
  async getItemSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : this.getDefaultStartDate();
    const end = this.getEndOfDay(endDate);
    return this.reportsService.getItemSalesReport(start, end);
  }

  @Get('categories')
  async getCategorySalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : this.getDefaultStartDate();
    const end = this.getEndOfDay(endDate);
    return this.reportsService.getCategorySalesReport(start, end);
  }

  @Get('cashiers')
  async getCashierSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : this.getDefaultStartDate();
    const end = this.getEndOfDay(endDate);
    return this.reportsService.getCashierSalesReport(start, end);
  }

  @Get('expenses')
  async getExpenseReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : this.getDefaultStartDate();
    const end = this.getEndOfDay(endDate);
    return this.reportsService.getExpenseReport(start, end);
  }

  private getDefaultStartDate(): Date {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getEndOfDay(endDate?: string): Date {
    const date = endDate ? new Date(endDate) : new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
