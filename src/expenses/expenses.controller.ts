import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/expenses.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User, Role } from '@prisma/client';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async create(@CurrentUser() user: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.CASHIER)
  async findAll(@CurrentUser() user: any) {
    if (user.role === Role.CASHIER) {
      return this.expensesService.findAll(user.id);
    }
    return this.expensesService.findAll();
  }
}
