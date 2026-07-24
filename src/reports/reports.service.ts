import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, TableStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ordersToday = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: today },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
    });

    const salesToday = ordersToday.reduce((acc, order) => acc + Number(order.grandTotal), 0);
    const totalOrdersCount = ordersToday.length;

    const activeTables = await this.prisma.table.count({
      where: { status: TableStatus.OCCUPIED, deletedAt: null },
    });

    const expensesTodayList = await this.prisma.expense.findMany({
      where: { date: { gte: today } },
    });
    const expensesToday = expensesTodayList.reduce((acc, exp) => acc + Number(exp.amount), 0);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: today },
          status: OrderStatus.COMPLETED,
        },
      },
      include: { dish: true },
    });

    const itemSales: Record<string, { name: string; qty: number; total: number }> = {};
    orderItems.forEach((item) => {
      if (!itemSales[item.dishId]) {
        itemSales[item.dishId] = { name: item.dish.name, qty: 0, total: 0 };
      }
      itemSales[item.dishId].qty += item.quantity;
      itemSales[item.dishId].total += Number(item.price) * item.quantity;
    });

    const topSelling = Object.values(itemSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const recentOrders = await this.prisma.order.findMany({
      where: { deletedAt: null },
      include: { table: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const openShifts = await this.prisma.shift.count({
      where: { status: 'OPEN' },
    });

    return {
      salesToday,
      totalOrdersCount,
      activeTables,
      expensesToday,
      topSelling,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        type: o.type,
        status: o.status,
        grandTotal: o.grandTotal,
        tableNumber: o.table?.number || null,
        createdAt: o.createdAt,
      })),
      shiftActive: openShifts > 0,
    };
  }

  async getSalesReport(start: Date, end: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const daily: Record<string, number> = {};
    orders.forEach((o) => {
      const dateStr = o.createdAt.toISOString().split('T')[0];
      daily[dateStr] = (daily[dateStr] || 0) + Number(o.grandTotal);
    });

    return Object.entries(daily).map(([date, total]) => ({ date, total }));
  }

  async getItemSalesReport(start: Date, end: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: OrderStatus.COMPLETED,
        },
      },
      include: { dish: true },
    });

    const mapping: Record<string, { name: string; quantity: number; revenue: number }> = {};
    items.forEach((item) => {
      if (!mapping[item.dishId]) {
        mapping[item.dishId] = { name: item.dish.name, quantity: 0, revenue: 0 };
      }
      mapping[item.dishId].quantity += item.quantity;
      mapping[item.dishId].revenue += Number(item.price) * item.quantity;
    });

    return Object.values(mapping).sort((a, b) => b.revenue - a.revenue);
  }

  async getCategorySalesReport(start: Date, end: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: OrderStatus.COMPLETED,
        },
      },
      include: {
        dish: {
          include: { category: true },
        },
      },
    });

    const mapping: Record<string, { name: string; quantity: number; revenue: number; dishIds: Set<string> }> = {};
    items.forEach((item) => {
      const cat = item.dish.category;
      if (!mapping[cat.id]) {
        mapping[cat.id] = { name: cat.name, quantity: 0, revenue: 0, dishIds: new Set() };
      }
      mapping[cat.id].dishIds.add(item.dishId);
      mapping[cat.id].quantity += item.quantity;
      mapping[cat.id].revenue += Number(item.price) * item.quantity;
    });

    return Object.values(mapping).map(c => ({
      name: c.name,
      itemsCount: c.dishIds.size,
      quantity: c.quantity,
      revenue: c.revenue
    })).sort((a, b) => b.revenue - a.revenue);
  }

  async getCashierSalesReport(start: Date, end: Date) {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
      include: {
        cashier: { select: { name: true, email: true } },
      },
    });

    const mapping: Record<string, { name: string; email: string; ordersCount: number; sales: number }> = {};
    orders.forEach((o) => {
      const key = o.cashierId;
      if (!mapping[key]) {
        mapping[key] = { name: o.cashier.name, email: o.cashier.email, ordersCount: 0, sales: 0 };
      }
      mapping[key].ordersCount += 1;
      mapping[key].sales += Number(o.grandTotal);
    });

    return Object.values(mapping);
  }

  async getExpenseReport(start: Date, end: Date) {
    const expenses = await this.prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const summary: Record<string, number> = {};
    expenses.forEach((e) => {
      summary[e.category] = (summary[e.category] || 0) + Number(e.amount);
    });

    return Object.entries(summary).map(([category, amount]) => ({ category, amount }));
  }
}
