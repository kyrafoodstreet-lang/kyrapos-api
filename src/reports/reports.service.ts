import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, TableStatus, PaymentStatus, ShiftStatus, PaymentMethod, OrderType } from '@prisma/client';

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

    let grandTotalRevenue = 0;
    const mapping: Record<
      string,
      {
        name: string;
        quantity: number;
        revenue: number;
        dishIds: Set<string>;
        dishSales: Record<string, { name: string; qty: number; revenue: number }>;
      }
    > = {};

    items.forEach((item) => {
      const cat = item.dish.category;
      if (!mapping[cat.id]) {
        mapping[cat.id] = {
          name: cat.name,
          quantity: 0,
          revenue: 0,
          dishIds: new Set(),
          dishSales: {},
        };
      }

      const itemRev = Number(item.price) * item.quantity;
      grandTotalRevenue += itemRev;
      mapping[cat.id].dishIds.add(item.dishId);
      mapping[cat.id].quantity += item.quantity;
      mapping[cat.id].revenue += itemRev;

      if (!mapping[cat.id].dishSales[item.dishId]) {
        mapping[cat.id].dishSales[item.dishId] = { name: item.dish.name, qty: 0, revenue: 0 };
      }
      mapping[cat.id].dishSales[item.dishId].qty += item.quantity;
      mapping[cat.id].dishSales[item.dishId].revenue += itemRev;
    });

    return Object.values(mapping)
      .map((c) => {
        const topDish = Object.values(c.dishSales).sort((a, b) => b.qty - a.qty)[0]?.name || 'N/A';
        return {
          name: c.name,
          itemsCount: c.dishIds.size,
          quantity: c.quantity,
          revenue: c.revenue,
          revenueShare: grandTotalRevenue > 0 ? Number(((c.revenue / grandTotalRevenue) * 100).toFixed(1)) : 0,
          topDish,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
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
        payments: { where: { status: PaymentStatus.COMPLETED } },
      },
    });

    const mapping: Record<
      string,
      {
        cashierId: string;
        name: string;
        email: string;
        ordersCount: number;
        cashSales: number;
        cardSales: number;
        upiSales: number;
        totalSales: number;
        avgOrderValue: number;
      }
    > = {};

    orders.forEach((o) => {
      const key = o.cashierId;
      if (!mapping[key]) {
        mapping[key] = {
          cashierId: o.cashierId,
          name: o.cashier.name,
          email: o.cashier.email,
          ordersCount: 0,
          cashSales: 0,
          cardSales: 0,
          upiSales: 0,
          totalSales: 0,
          avgOrderValue: 0,
        };
      }

      mapping[key].ordersCount += 1;
      const gTotal = Number(o.grandTotal);
      mapping[key].totalSales += gTotal;

      o.payments.forEach((p) => {
        const amt = Number(p.amount);
        if (p.method === 'CASH') mapping[key].cashSales += amt;
        else if (p.method === 'CARD') mapping[key].cardSales += amt;
        else if (p.method === 'UPI') mapping[key].upiSales += amt;
        else if (p.method === 'MIXED') {
          const details = p.details as any;
          if (details) {
            mapping[key].cashSales += Number(details.cashAmount || 0);
            mapping[key].cardSales += Number(details.cardAmount || 0);
            mapping[key].upiSales += Number(details.upiAmount || 0);
          } else {
            mapping[key].cashSales += amt;
          }
        }
      });
    });

    return Object.values(mapping).map((item) => ({
      name: item.name,
      email: item.email,
      ordersCount: item.ordersCount,
      cashSales: item.cashSales,
      upiSales: item.upiSales,
      cardSales: item.cardSales,
      totalSales: item.totalSales,
      avgOrderValue: item.ordersCount > 0 ? Number((item.totalSales / item.ordersCount).toFixed(2)) : 0,
    })).sort((a, b) => b.totalSales - a.totalSales);
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

  async getEmployeeSummary(cashierId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Completed orders by this cashier today
    const ordersToday = await this.prisma.order.findMany({
      where: {
        cashierId,
        createdAt: { gte: today, lt: tomorrow },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
        table: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalSales = 0;
    let cashCollection = 0;
    let upiCollection = 0;
    let cardCollection = 0;
    const totalBillsGenerated = ordersToday.length;

    const uniqueCustomers = new Set<string>();

    ordersToday.forEach((order) => {
      const gTotal = Number(order.grandTotal);
      totalSales += gTotal;

      if (order.customerPhone) {
        uniqueCustomers.add(order.customerPhone);
      } else if (order.customerName) {
        uniqueCustomers.add(order.customerName);
      } else {
        uniqueCustomers.add(`walkin-${order.id}`);
      }

      order.payments.forEach((payment) => {
        const amt = Number(payment.amount);
        if (payment.method === 'CASH') {
          cashCollection += amt;
        } else if (payment.method === 'UPI') {
          upiCollection += amt;
        } else if (payment.method === 'CARD') {
          cardCollection += amt;
        } else if (payment.method === 'MIXED') {
          const details = payment.details as any;
          if (details) {
            cashCollection += Number(details.cashAmount || 0);
            cardCollection += Number(details.cardAmount || 0);
            upiCollection += Number(details.upiAmount || 0);
          } else {
            cashCollection += amt; // fallback
          }
        }
      });
    });

    const customersServed = uniqueCustomers.size;
    const averageBillValue = totalBillsGenerated > 0 ? Number((totalSales / totalBillsGenerated).toFixed(2)) : 0;

    // Timeline of activity
    const billingActivityTimeline = ordersToday.slice(0, 20).map((order) => {
      let payMethod = 'Mixed';
      if (order.payments.length > 0) {
        payMethod = order.payments[0].method;
        if (order.payments.length > 1) payMethod = 'MIXED';
      }
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        type: order.type,
        grandTotal: Number(order.grandTotal),
        customerName: order.customerName || 'Walk-in Customer',
        customerPhone: order.customerPhone || '',
        paymentMethod: payMethod,
        createdAt: order.createdAt,
      };
    });

    // Current shift details
    const lastShift = await this.prisma.shift.findFirst({
      where: { cashierId },
      orderBy: { createdAt: 'desc' },
    });

    let shiftInfo = null;
    if (lastShift) {
      if (lastShift.status === 'OPEN') {
        // Query completed orders in this shift
        const shiftOrders = await this.prisma.order.findMany({
          where: {
            shiftId: lastShift.id,
            status: OrderStatus.COMPLETED,
            deletedAt: null,
          },
          include: {
            payments: { where: { status: PaymentStatus.COMPLETED } },
          },
        });

        let shiftCashSales = 0;
        shiftOrders.forEach((o) => {
          o.payments.forEach((p) => {
            if (p.method === 'CASH') {
              shiftCashSales += Number(p.amount);
            } else if (p.method === 'MIXED') {
              const details = p.details as any;
              if (details) {
                shiftCashSales += Number(details.cashAmount || 0);
              }
            }
          });
        });

        // Sum up expenses logged by this user during this shift (since openingTime)
        const shiftExpenses = await this.prisma.expense.aggregate({
          where: {
            userId: cashierId,
            OR: [
              { createdAt: { gte: lastShift.openingTime } },
              { date: { gte: lastShift.openingTime } },
            ],
          },
          _sum: { amount: true },
        });

        const totalExpensesLogged = Number(shiftExpenses._sum.amount || 0);
        const expectedCash = Number(lastShift.openingCash) + shiftCashSales - totalExpensesLogged;

        shiftInfo = {
          id: lastShift.id,
          status: lastShift.status,
          openingCash: Number(lastShift.openingCash),
          expectedCash,
          physicalCash: null,
          cashDifference: null,
          totalExpensesLogged,
        };
      } else {
        shiftInfo = {
          id: lastShift.id,
          status: lastShift.status,
          openingCash: Number(lastShift.openingCash),
          expectedCash: Number(lastShift.expectedCash || 0),
          physicalCash: Number(lastShift.actualCash || 0),
          cashDifference: Number(lastShift.cashDifference || 0),
          totalExpensesLogged: Number(lastShift.closingExpenses || 0),
        };
      }
    }

    return {
      kpis: {
        totalSales,
        cashCollection,
        upiCollection,
        cardCollection,
        totalBillsGenerated,
        customersServed,
        averageBillValue,
      },
      paymentBreakdown: {
        cash: cashCollection,
        upi: upiCollection,
        card: cardCollection,
      },
      billingActivityTimeline,
      recentTransactions: billingActivityTimeline,
      shiftInfo,
    };
  }

  async getExecutiveSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Fetch Completed POS orders today
    const posOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
      },
    });

    // 2. Fetch completed Game sessions today
    const gameSessionsToday = await this.prisma.gameSession.findMany({
      where: {
        entryTime: { gte: today, lt: tomorrow },
        status: 'COMPLETED',
      },
    });

    // 3. Fetch Game payments today
    const gamePayments = await this.prisma.gamePayment.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
      },
    });

    // 4. Fetch Party Hall payments today
    const partyHallPayments = await this.prisma.partyHallPayment.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
      },
    });

    // 5. Fetch Party Hall bookings today
    const partyHallBookingsToday = await this.prisma.partyHallBooking.findMany({
      where: {
        bookingDate: { gte: today, lt: tomorrow },
        status: { in: ['BOOKED', 'RESERVED'] },
      },
    });

    // Calculations: Revenue
    const posRevenue = posOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const gameRevenue = gamePayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const partyHallRevenue = partyHallPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRevenue = posRevenue + gameRevenue + partyHallRevenue;

    // Calculations: Orders
    const totalOrders = posOrders.length + gameSessionsToday.length + partyHallBookingsToday.length;

    // Calculations: Customers
    const customerSet = new Set<string>();
    posOrders.forEach((o) => {
      if (o.customerPhone) customerSet.add(o.customerPhone);
      else if (o.customerName) customerSet.add(o.customerName);
      else customerSet.add(`pos-walkin-${o.id}`);
    });

    const gameSessionsWithCust = await this.prisma.gameSession.findMany({
      where: { entryTime: { gte: today, lt: tomorrow } },
      include: { customer: true },
    });
    gameSessionsWithCust.forEach((s) => {
      customerSet.add(s.customer.mobile || s.customer.name);
    });

    const partyHallBookingsWithCust = await this.prisma.partyHallBooking.findMany({
      where: { bookingDate: { gte: today, lt: tomorrow } },
      include: { customer: true },
    });
    partyHallBookingsWithCust.forEach((b) => {
      customerSet.add(b.customer.mobile || b.customer.name);
    });

    const totalCustomers = customerSet.size;
    const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

    // 6. Category-wise Sales
    const posOrderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: today, lt: tomorrow },
          status: OrderStatus.COMPLETED,
          deletedAt: null,
        },
      },
      include: {
        dish: {
          include: { category: true },
        },
      },
    });

    let foodSales = 0;
    let beverageSales = 0;
    let dessertSales = 0;
    const dynamicOtherCategories: Record<string, number> = {};

    posOrderItems.forEach((item) => {
      const catName = item.dish.category.name.trim();
      const lowerCatName = catName.toLowerCase();
      const itemRevenue = Number(item.price) * item.quantity;

      if (lowerCatName === 'food') {
        foodSales += itemRevenue;
      } else if (lowerCatName === 'beverage' || lowerCatName === 'beverages' || lowerCatName === 'drinks') {
        beverageSales += itemRevenue;
      } else if (lowerCatName === 'dessert' || lowerCatName === 'desserts' || lowerCatName === 'sweets') {
        dessertSales += itemRevenue;
      } else {
        dynamicOtherCategories[catName] = (dynamicOtherCategories[catName] || 0) + itemRevenue;
      }
    });

    const otherCategories = Object.entries(dynamicOtherCategories).map(([category, revenue]) => ({
      category,
      revenue,
    }));

    // Top Selling Categories
    const allCategories = [
      { name: 'Food', revenue: foodSales },
      { name: 'Beverages', revenue: beverageSales },
      { name: 'Desserts', revenue: dessertSales },
      { name: 'Games', revenue: gameRevenue },
      { name: 'Party Hall', revenue: partyHallRevenue },
      ...otherCategories.map((oc) => ({ name: oc.category, revenue: oc.revenue })),
    ];

    const topSellingCategories = allCategories
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // Top Selling Items (POS completed today)
    const itemSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    posOrderItems.forEach((item) => {
      const dishId = item.dishId;
      if (!itemSalesMap[dishId]) {
        itemSalesMap[dishId] = { name: item.dish.name, quantity: 0, revenue: 0 };
      }
      itemSalesMap[dishId].quantity += item.quantity;
      itemSalesMap[dishId].revenue += Number(item.price) * item.quantity;
    });

    const topSellingItems = Object.values(itemSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Payment Collection Breakdown (Cash, UPI, Card)
    let cashCollection = 0;
    let upiCollection = 0;
    let cardCollection = 0;

    // POS
    posOrders.forEach((o) => {
      o.payments.forEach((p) => {
        if (p.status === PaymentStatus.COMPLETED) {
          const amt = Number(p.amount);
          if (p.method === 'CASH') cashCollection += amt;
          else if (p.method === 'UPI') upiCollection += amt;
          else if (p.method === 'CARD') cardCollection += amt;
          else if (p.method === 'MIXED') {
            const details = p.details as any;
            if (details) {
              cashCollection += Number(details.cashAmount || 0);
              cardCollection += Number(details.cardAmount || 0);
              upiCollection += Number(details.upiAmount || 0);
            } else {
              cashCollection += amt;
            }
          }
        }
      });
    });

    // Games
    gamePayments.forEach((p) => {
      const amt = Number(p.amount);
      const method = p.method.toUpperCase();
      if (method.includes('CASH')) cashCollection += amt;
      else if (method.includes('UPI')) upiCollection += amt;
      else if (method.includes('CARD')) cardCollection += amt;
    });

    // Party Hall
    partyHallPayments.forEach((p) => {
      const amt = Number(p.amount);
      const method = p.method.toUpperCase();
      if (method.includes('CASH')) cashCollection += amt;
      else if (method.includes('UPI') || method.includes('BANK')) upiCollection += amt;
      else if (method.includes('CARD')) cardCollection += amt;
    });

    // Order Type Breakdown (POS completed orders)
    let dineIn = 0;
    let takeaway = 0;
    let delivery = 0;

    posOrders.forEach((o) => {
      if (o.type === 'DINE_IN') dineIn++;
      else if (o.type === 'TAKEAWAY') takeaway++;
      else if (o.type === 'DELIVERY') delivery++;
    });

    // Sales Trend (Today's Sales Trend: Hourly breakdown of POS + Games + Party Hall payments)
    const hourlySales: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlySales[i] = 0;
    }

    posOrders.forEach((o) => {
      const hr = new Date(o.createdAt).getHours();
      hourlySales[hr] = (hourlySales[hr] || 0) + Number(o.grandTotal);
    });

    gamePayments.forEach((p) => {
      const hr = new Date(p.date).getHours();
      hourlySales[hr] = (hourlySales[hr] || 0) + Number(p.amount);
    });

    partyHallPayments.forEach((p) => {
      const hr = new Date(p.date).getHours();
      hourlySales[hr] = (hourlySales[hr] || 0) + Number(p.amount);
    });

    const todaySalesTrend = Object.entries(hourlySales).map(([hr, total]) => {
      const formattedHour = `${hr.padStart(2, '0')}:00`;
      return { time: formattedHour, revenue: total };
    }).sort((a, b) => a.time.localeCompare(b.time));

    return {
      kpis: {
        totalRevenue,
        totalOrders,
        totalCustomers,
        averageOrderValue,
      },
      categoryWiseSales: {
        foodSales,
        beverageSales,
        dessertSales,
        gamesRevenue: gameRevenue,
        partyHallRevenue,
        otherCategories,
      },
      topSellingCategories,
      topSellingItems,
      paymentBreakdown: {
        cash: cashCollection,
        upi: upiCollection,
        card: cardCollection,
      },
      orderTypeBreakdown: {
        dineIn,
        takeaway,
        delivery,
      },
      todaySalesTrend,
    };
  }
}
