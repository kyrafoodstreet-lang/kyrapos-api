import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenShiftDto, CloseShiftDto } from './dto/shifts.dto';
import { ShiftStatus, OrderStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async getActiveShift(cashierId: string) {
    const active = await this.prisma.shift.findFirst({
      where: {
        cashierId,
        status: ShiftStatus.OPEN,
      },
    });
    if (!active) return null;

    // Sum up completed orders in this shift
    const orders = await this.prisma.order.findMany({
      where: {
        shiftId: active.id,
        status: OrderStatus.COMPLETED,
      },
      include: {
        payments: true,
      },
    });

    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;

    for (const order of orders) {
      for (const payment of order.payments) {
        if (payment.status === PaymentStatus.COMPLETED) {
          const amt = Number(payment.amount);
          if (payment.method === PaymentMethod.CASH) {
            cashSales += amt;
          } else if (payment.method === PaymentMethod.CARD) {
            cardSales += amt;
          } else if (payment.method === PaymentMethod.UPI) {
            upiSales += amt;
          } else if (payment.method === PaymentMethod.MIXED) {
            const details = payment.details as any;
            if (details) {
              cashSales += Number(details.cashAmount || 0);
              cardSales += Number(details.cardAmount || 0);
              upiSales += Number(details.upiAmount || 0);
            }
          }
        }
      }
    }

    // Sum up expenses logged by this user during this shift (since openingTime)
    const expenses = await this.prisma.expense.aggregate({
      where: {
        userId: cashierId,
        date: { gte: active.openingTime },
      },
      _sum: { amount: true },
    });
    const totalExpenses = Number(expenses._sum.amount || 0);

    // Query category sales details
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          shiftId: active.id,
          status: OrderStatus.COMPLETED,
        },
      },
      include: {
        dish: {
          include: { category: true },
        },
      },
    });

    const categorySalesMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const item of orderItems) {
      const catName = item.dish.category.name;
      if (!categorySalesMap[catName]) {
        categorySalesMap[catName] = { quantity: 0, revenue: 0 };
      }
      categorySalesMap[catName].quantity += item.quantity;
      categorySalesMap[catName].revenue += Number(item.price) * item.quantity;
    }

    const categorySales = Object.entries(categorySalesMap).map(([name, val]) => ({
      name,
      quantity: val.quantity,
      revenue: val.revenue,
    }));

    return {
      ...active,
      computedCashSales: cashSales,
      computedCardSales: cardSales,
      computedUpiSales: upiSales,
      computedExpenses: totalExpenses,
      categorySales,
    };
  }

  async openShift(cashierId: string, dto: OpenShiftDto) {
    const active = await this.getActiveShift(cashierId);
    if (active) {
      throw new BadRequestException('You already have an active open shift');
    }
    return this.prisma.shift.create({
      data: {
        cashierId,
        openingCash: dto.openingCash,
        status: ShiftStatus.OPEN,
      },
    });
  }

  async closeShift(cashierId: string, dto: CloseShiftDto) {
    const active = await this.prisma.shift.findFirst({
      where: { cashierId, status: ShiftStatus.OPEN },
    });
    if (!active) {
      throw new BadRequestException('No active shift found to close');
    }

    // Sum up completed orders in this shift
    const orders = await this.prisma.order.findMany({
      where: {
        shiftId: active.id,
        status: OrderStatus.COMPLETED,
      },
      include: {
        payments: true,
      },
    });

    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;

    for (const order of orders) {
      for (const payment of order.payments) {
        if (payment.status === PaymentStatus.COMPLETED) {
          const amt = Number(payment.amount);
          if (payment.method === PaymentMethod.CASH) {
            cashSales += amt;
          } else if (payment.method === PaymentMethod.CARD) {
            cardSales += amt;
          } else if (payment.method === PaymentMethod.UPI) {
            upiSales += amt;
          } else if (payment.method === PaymentMethod.MIXED) {
            const details = payment.details as any;
            if (details) {
              cashSales += Number(details.cashAmount || 0);
              cardSales += Number(details.cardAmount || 0);
              upiSales += Number(details.upiAmount || 0);
            }
          }
        }
      }
    }

    // Sum up expenses logged by this user during this shift
    const expenses = await this.prisma.expense.aggregate({
      where: {
        userId: cashierId,
        date: { gte: active.openingTime },
      },
      _sum: { amount: true },
    });
    const totalExpenses = Number(expenses._sum.amount || 0);

    const openingCash = Number(active.openingCash);
    const expectedCash = openingCash + cashSales - totalExpenses;
    const cashDifference = dto.actualCash - expectedCash;
    const upiDifference = dto.actualUpi - upiSales;

    // Query category sales details
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          shiftId: active.id,
          status: OrderStatus.COMPLETED,
        },
      },
      include: {
        dish: {
          include: { category: true },
        },
      },
    });

    const categorySalesMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const item of orderItems) {
      const catName = item.dish.category.name;
      if (!categorySalesMap[catName]) {
        categorySalesMap[catName] = { quantity: 0, revenue: 0 };
      }
      categorySalesMap[catName].quantity += item.quantity;
      categorySalesMap[catName].revenue += Number(item.price) * item.quantity;
    }

    const categorySales = Object.entries(categorySalesMap).map(([name, val]) => ({
      name,
      quantity: val.quantity,
      revenue: val.revenue,
    }));

    const closedShift = await this.prisma.shift.update({
      where: { id: active.id },
      data: {
        closingCashSales: cashSales,
        closingCardSales: cardSales,
        closingUpiSales: upiSales,
        closingExpenses: totalExpenses,
        expectedCash,
        actualCash: dto.actualCash,
        cashDifference,
        actualUpi: dto.actualUpi,
        upiDifference,
        closingNotes: dto.closingNotes,
        closingTime: new Date(),
        status: ShiftStatus.CLOSED,
      },
      include: {
        cashier: { select: { name: true, email: true } },
      },
    });

    return {
      ...closedShift,
      categorySales,
    };
  }

  async findAll(cashierId?: string) {
    return this.prisma.shift.findMany({
      where: cashierId ? { cashierId } : {},
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveShift(shiftId: string, managerId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
    if (shift.status !== ShiftStatus.CLOSED) {
      throw new BadRequestException('Shift must be closed before approval');
    }
    return this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        approvedById: managerId,
      },
    });
  }
}
