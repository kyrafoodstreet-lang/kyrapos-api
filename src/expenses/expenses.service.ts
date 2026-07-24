import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/expenses.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        category: dto.category,
        amount: dto.amount,
        notes: dto.notes,
        date: dto.date ? new Date(dto.date) : new Date(),
        userId,
      },
    });
  }

  async findAll(userId?: string) {
    return this.prisma.expense.findMany({
      where: userId ? { userId } : {},
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}
