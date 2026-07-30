import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/expenses.dto';
import { Role, ShiftStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(user: { id: string; role: Role }, dto: CreateExpenseDto) {
    // 1. Shift Control Enforcement for Cashiers: Must have an OPEN shift to log expenses
    if (user.role === Role.CASHIER) {
      const activeShift = await this.prisma.shift.findFirst({
        where: { cashierId: user.id, status: ShiftStatus.OPEN },
      });
      if (!activeShift) {
        throw new BadRequestException(
          'Cashier shift is CLOSED. Cashiers can only log expenses when a cashier shift is OPEN.',
        );
      }
    }

    // Preserve current exact time so expense.date is always >= active shift openingTime
    let expenseDate = new Date();
    if (dto.date) {
      const parsed = new Date(dto.date);
      const now = new Date();
      if (parsed.toDateString() === now.toDateString()) {
        expenseDate = now;
      } else {
        parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        expenseDate = parsed;
      }
    }

    return this.prisma.expense.create({
      data: {
        category: dto.category,
        amount: dto.amount,
        notes: dto.notes,
        date: expenseDate,
        userId: user.id,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async findAll(user?: { id: string; role: Role }, startDate?: string, endDate?: string) {
    const where: any = {};
    if (user && user.role === Role.CASHIER) {
      where.userId = user.id;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        where.date.lte = eDate;
      }
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
