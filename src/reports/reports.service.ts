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

    // Calculations: Revenue
    const posRevenue = posOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const gameRevenue = gamePayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRevenue = posRevenue + gameRevenue;

    // Calculations: Orders
    const totalOrders = posOrders.length + gameSessionsToday.length;

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

    // Order Type Breakdown (POS completed orders)
    let dineIn = 0;
    let takeaway = 0;
    let delivery = 0;

    posOrders.forEach((o) => {
      if (o.type === 'DINE_IN') dineIn++;
      else if (o.type === 'TAKEAWAY') takeaway++;
      else if (o.type === 'DELIVERY') delivery++;
    });

    // Sales Trend (Today's Sales Trend: Hourly breakdown of POS + Games payments)
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

  async getFinanceReport(start: Date, end: Date) {
    // 1. POS Payments (from completed orders)
    const posPayments = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: PaymentStatus.COMPLETED,
        order: {
          deletedAt: null,
          status: OrderStatus.COMPLETED,
        },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            grandTotal: true,
            type: true,
            cashier: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Game Payments
    const gamePayments = await this.prisma.gamePayment.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      include: {
        session: {
          select: {
            sessionId: true,
            grandTotal: true,
            customer: { select: { name: true, mobile: true } },
            game: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Aggregate KPIs
    let totalCash = 0;
    let totalUpi = 0;
    let totalCard = 0;
    let totalMixed = 0;
    let totalRevenue = 0;
    let totalTransactions = 0;

    // Build unified transaction list
    const transactions: any[] = [];

    // Process POS payments
    posPayments.forEach((p) => {
      const amt = Number(p.amount);
      totalTransactions++;

      if (p.method === 'CASH') totalCash += amt;
      else if (p.method === 'UPI') totalUpi += amt;
      else if (p.method === 'CARD') totalCard += amt;
      else if (p.method === 'MIXED') {
        totalMixed += amt;
        const details = p.details as any;
        if (details) {
          totalCash += Number(details.cashAmount || 0);
          totalUpi += Number(details.upiAmount || 0);
          totalCard += Number(details.cardAmount || 0);
        }
      }
      totalRevenue += amt;

      transactions.push({
        id: p.id,
        source: 'POS',
        referenceNumber: `#${p.order.orderNumber}`,
        customerName: p.order.customerName || 'Walk-in Customer',
        customerPhone: p.order.customerPhone || '',
        amount: amt,
        method: p.method,
        details: p.details,
        orderType: p.order.type,
        cashierName: p.order.cashier?.name || 'Unknown',
        date: p.createdAt,
      });
    });

    // Process Game payments
    gamePayments.forEach((p) => {
      const amt = Number(p.amount);
      const method = p.method.toUpperCase();
      totalTransactions++;

      if (method.includes('CASH')) totalCash += amt;
      else if (method.includes('UPI')) totalUpi += amt;
      else if (method.includes('CARD')) totalCard += amt;
      else if (method.includes('MIXED')) totalMixed += amt;
      totalRevenue += amt;

      transactions.push({
        id: p.id,
        source: 'GAMES',
        referenceNumber: `GS-${p.session.sessionId}`,
        customerName: p.session.customer?.name || 'Guest',
        customerPhone: p.session.customer?.mobile || '',
        amount: amt,
        method: method,
        details: null,
        orderType: p.session.game?.name || 'Game',
        cashierName: '-',
        date: p.date,
      });
    });

    // Sort all transactions by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Daily breakdown for chart
    const dailyRevenue: Record<string, { cash: number; upi: number; card: number; total: number }> = {};
    transactions.forEach((t) => {
      const dateStr = new Date(t.date).toISOString().split('T')[0];
      if (!dailyRevenue[dateStr]) {
        dailyRevenue[dateStr] = { cash: 0, upi: 0, card: 0, total: 0 };
      }
      dailyRevenue[dateStr].total += t.amount;
      const m = t.method.toUpperCase();
      if (m === 'CASH') dailyRevenue[dateStr].cash += t.amount;
      else if (m === 'UPI' || m === 'BANK_TRANSFER') dailyRevenue[dateStr].upi += t.amount;
      else if (m === 'CARD') dailyRevenue[dateStr].card += t.amount;
      else if (m === 'MIXED') {
        if (t.details) {
          dailyRevenue[dateStr].cash += Number(t.details.cashAmount || 0);
          dailyRevenue[dateStr].upi += Number(t.details.upiAmount || 0);
          dailyRevenue[dateStr].card += Number(t.details.cardAmount || 0);
        }
      }
    });

    const dailyBreakdown = Object.entries(dailyRevenue)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Source breakdown
    const sourceBreakdown = {
      pos: transactions.filter((t) => t.source === 'POS').reduce((s, t) => s + t.amount, 0),
      games: transactions.filter((t) => t.source === 'GAMES').reduce((s, t) => s + t.amount, 0),
    };

    return {
      kpis: {
        totalRevenue,
        totalTransactions,
        totalCash,
        totalUpi,
        totalCard,
        totalMixed,
        averageTransactionValue: totalTransactions > 0 ? Number((totalRevenue / totalTransactions).toFixed(2)) : 0,
      },
      sourceBreakdown,
      dailyBreakdown,
      transactions,
    };
  }

  async getAdminDashboardStats(period: 'today' | 'weekly' | 'monthly' = 'today', referenceDateStr?: string) {
    const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();

    let currentStart: Date;
    let currentEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;
    let periodLabel = '';
    const dayKeys: { key: string; label: string; dateStr: string }[] = [];

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    if (period === 'today') {
      currentStart = new Date(ref);
      currentStart.setHours(0, 0, 0, 0);

      currentEnd = new Date(ref);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(currentStart);
      prevStart.setDate(currentStart.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);

      prevEnd = new Date(prevStart);
      prevEnd.setHours(23, 59, 59, 999);

      const isToday = currentStart.toDateString() === now.toDateString();
      const monthStr = currentStart.toLocaleString('default', { month: 'short' });
      periodLabel = isToday
        ? `Today, ${monthStr} ${currentStart.getDate()}, ${currentStart.getFullYear()}`
        : `${monthStr} ${currentStart.getDate()}, ${currentStart.getFullYear()}`;

      // Hourly buckets from 9 AM (09:00) to 10 PM (22:00)
      const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
      hours.forEach((h) => {
        const hourLabel = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
        dayKeys.push({
          key: String(h),
          label: hourLabel,
          dateStr: String(h),
        });
      });
    } else if (period === 'monthly') {
      const year = ref.getFullYear();
      const month = ref.getMonth();

      currentStart = new Date(year, month, 1, 0, 0, 0, 0);
      currentEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      prevStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(year, month, 0, 23, 59, 59, 999);

      const monthName = currentStart.toLocaleString('default', { month: 'long' });
      periodLabel = `${monthName} ${year}`;

      const daysInMonth = currentEnd.getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dObj = new Date(year, month, d);
        const yyyy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        dayKeys.push({
          key: String(d),
          label: `${d}`,
          dateStr,
        });
      }
    } else {
      // Weekly (Monday to Sunday)
      const dayOfWeek = ref.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

      currentStart = new Date(ref);
      currentStart.setDate(ref.getDate() + diffToMonday);
      currentStart.setHours(0, 0, 0, 0);

      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);
      currentEnd.setHours(23, 59, 59, 999);

      prevStart = new Date(currentStart);
      prevStart.setDate(currentStart.getDate() - 7);
      prevStart.setHours(0, 0, 0, 0);

      prevEnd = new Date(prevStart);
      prevEnd.setDate(prevStart.getDate() + 6);
      prevEnd.setHours(23, 59, 59, 999);

      const startMonth = currentStart.toLocaleString('default', { month: 'short' });
      const endMonth = currentEnd.toLocaleString('default', { month: 'short' });
      if (startMonth === endMonth) {
        periodLabel = `${startMonth} ${currentStart.getDate()} – ${currentEnd.getDate()}, ${currentStart.getFullYear()}`;
      } else {
        periodLabel = `${startMonth} ${currentStart.getDate()} – ${endMonth} ${currentEnd.getDate()}, ${currentStart.getFullYear()}`;
      }

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let i = 0; i < 7; i++) {
        const dObj = new Date(currentStart);
        dObj.setDate(currentStart.getDate() + i);
        const yyyy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        dayKeys.push({
          key: dayNames[i],
          label: dayNames[i],
          dateStr,
        });
      }
    }

    // 1. Current Period Orders (Food)
    const currentOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: currentStart, lte: currentEnd },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
      include: {
        items: { include: { dish: true } },
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Current Period Game Sessions (Trampoline & Coin Games)
    const currentSessions = await this.prisma.gameSession.findMany({
      where: {
        entryTime: { gte: currentStart, lte: currentEnd },
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: {
        game: true,
        pricing: true,
        customer: true,
        payments: true,
      },
      orderBy: { entryTime: 'asc' },
    });

    // 3. Previous Period for growth calculations
    const prevOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
    });

    const prevSessions = await this.prisma.gameSession.findMany({
      where: {
        entryTime: { gte: prevStart, lte: prevEnd },
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: { game: true, pricing: true },
    });

    // 4. Today's Data
    const todayOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        status: OrderStatus.COMPLETED,
        deletedAt: null,
      },
    });

    const todaySessions = await this.prisma.gameSession.findMany({
      where: {
        entryTime: { gte: todayStart, lte: todayEnd },
      },
      include: { game: true, pricing: true },
    });

    const activeSessionsNow = await this.prisma.gameSession.count({
      where: { status: 'ACTIVE' },
    });

    // Helpers to classify game sessions
    const isTrampoline = (s: any) => {
      const gName = (s.game?.name || '').toLowerCase();
      const pName = (s.pricing?.name || '').toLowerCase();
      const notes = (s.notes || '').toLowerCase();
      if (gName.includes('trampoline') || pName.includes('trampoline') || notes.includes('trampoline')) return true;
      if (s.adultCount > 0 || s.childCount > 0) return true;
      return false;
    };

    // Calculate Current Revenues & Counts
    const foodRevenue = currentOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const foodOrdersCount = currentOrders.length;

    let trampolineRevenue = 0;
    let trampolineSessionsCount = 0;
    let trampolineAdults = 0;
    let trampolineChildren = 0;

    let coinGamesRevenue = 0;
    let coinGamesTransactionsCount = 0;
    let totalCoinsSold = 0;
    const coinPackageBreakdown: Record<string, { name: string; price: number; sales: number; revenue: number }> = {
      '1_coin': { name: '1 Coin', price: 40, sales: 0, revenue: 0 },
      '4_coins': { name: '4 Coins', price: 150, sales: 0, revenue: 0 },
      '10_coins': { name: '10 Coins', price: 350, sales: 0, revenue: 0 },
      'other': { name: 'Custom Coin Pack', price: 0, sales: 0, revenue: 0 },
    };

    currentSessions.forEach((s) => {
      const amt = Number(s.grandTotal || 0);
      if (isTrampoline(s)) {
        trampolineRevenue += amt;
        trampolineSessionsCount += 1;
        trampolineAdults += s.adultCount || s.guestCount || 1;
        trampolineChildren += s.childCount || 0;
      } else {
        coinGamesRevenue += amt;
        coinGamesTransactionsCount += 1;
        const notes = (s.notes || '').toLowerCase();
        const pName = (s.pricing?.name || '').toLowerCase();

        if (pName.includes('1 coin') || notes.includes('1 coin') || amt === 40) {
          coinPackageBreakdown['1_coin'].sales += 1;
          coinPackageBreakdown['1_coin'].revenue += amt;
          totalCoinsSold += 1;
        } else if (pName.includes('4 coin') || notes.includes('4 coin') || amt === 150) {
          coinPackageBreakdown['4_coins'].sales += 1;
          coinPackageBreakdown['4_coins'].revenue += amt;
          totalCoinsSold += 4;
        } else if (pName.includes('10 coin') || notes.includes('10 coin') || amt === 350) {
          coinPackageBreakdown['10_coins'].sales += 1;
          coinPackageBreakdown['10_coins'].revenue += amt;
          totalCoinsSold += 10;
        } else {
          const estCoins = Math.max(1, Math.round(amt / 40));
          coinPackageBreakdown['other'].sales += 1;
          coinPackageBreakdown['other'].revenue += amt;
          totalCoinsSold += estCoins;
        }
      }
    });

    const totalRevenue = foodRevenue + trampolineRevenue + coinGamesRevenue;
    const totalTransactions = foodOrdersCount + trampolineSessionsCount + coinGamesTransactionsCount;
    const averageTransactionValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // Previous Period Calculations
    const prevFoodRevenue = prevOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    let prevTrampolineRevenue = 0;
    let prevCoinGamesRevenue = 0;

    prevSessions.forEach((s) => {
      const amt = Number(s.grandTotal || 0);
      if (isTrampoline(s)) {
        prevTrampolineRevenue += amt;
      } else {
        prevCoinGamesRevenue += amt;
      }
    });

    const prevTotalRevenue = prevFoodRevenue + prevTrampolineRevenue + prevCoinGamesRevenue;

    const calcChange = (curr: number, prev: number) => {
      if (prev <= 0) return null;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const revenueGrowth = {
      total: calcChange(totalRevenue, prevTotalRevenue),
      food: calcChange(foodRevenue, prevFoodRevenue),
      trampoline: calcChange(trampolineRevenue, prevTrampolineRevenue),
      coinGames: calcChange(coinGamesRevenue, prevCoinGamesRevenue),
      previousTotalRevenue: prevTotalRevenue,
    };

    // Percentage Mix
    const revenueMix = {
      food: totalRevenue > 0 ? Number(((foodRevenue / totalRevenue) * 100).toFixed(1)) : 0,
      trampoline: totalRevenue > 0 ? Number(((trampolineRevenue / totalRevenue) * 100).toFixed(1)) : 0,
      coinGames: totalRevenue > 0 ? Number(((coinGamesRevenue / totalRevenue) * 100).toFixed(1)) : 0,
    };

    // Daily Timeline Series for Line Chart
    const dailyMap: Record<string, { food: number; trampoline: number; coinGames: number; total: number; transactions: number }> = {};
    dayKeys.forEach((d) => {
      dailyMap[d.dateStr] = { food: 0, trampoline: 0, coinGames: 0, total: 0, transactions: 0 };
    });

    currentOrders.forEach((o) => {
      const slotKey = period === 'today' ? String(o.createdAt.getHours()) : o.createdAt.toISOString().split('T')[0];
      if (dailyMap[slotKey]) {
        const amt = Number(o.grandTotal);
        dailyMap[slotKey].food += amt;
        dailyMap[slotKey].total += amt;
        dailyMap[slotKey].transactions += 1;
      }
    });

    currentSessions.forEach((s) => {
      const slotKey = period === 'today' ? String(s.entryTime.getHours()) : s.entryTime.toISOString().split('T')[0];
      if (dailyMap[slotKey]) {
        const amt = Number(s.grandTotal);
        if (isTrampoline(s)) {
          dailyMap[slotKey].trampoline += amt;
        } else {
          dailyMap[slotKey].coinGames += amt;
        }
        dailyMap[slotKey].total += amt;
        dailyMap[slotKey].transactions += 1;
      }
    });

    const trendSeries = dayKeys.map((dk) => {
      const val = dailyMap[dk.dateStr] || { food: 0, trampoline: 0, coinGames: 0, total: 0, transactions: 0 };
      return {
        key: dk.key,
        label: dk.label,
        date: dk.dateStr,
        food: val.food,
        trampoline: val.trampoline,
        coinGames: val.coinGames,
        total: val.total,
        transactions: val.transactions,
      };
    });

    // Food Item Sales
    const foodItemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    currentOrders.forEach((o) => {
      o.items.forEach((item) => {
        const dId = item.dishId;
        const dishName = item.dish?.name || 'Item';
        if (!foodItemMap[dId]) {
          foodItemMap[dId] = { name: dishName, quantity: 0, revenue: 0 };
        }
        foodItemMap[dId].quantity += item.quantity;
        foodItemMap[dId].revenue += Number(item.price) * item.quantity;
      });
    });
    const topFoodItems = Object.values(foodItemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Payment Methods Breakdown
    const paymentMethods = {
      cash: 0,
      upi: 0,
      mixed: 0,
      card: 0,
    };

    currentOrders.forEach((o) => {
      o.payments.forEach((p) => {
        const m = (p.method || '').toUpperCase();
        const amt = Number(p.amount);
        if (m === 'CASH') paymentMethods.cash += amt;
        else if (m === 'UPI') paymentMethods.upi += amt;
        else if (m === 'MIXED') paymentMethods.mixed += amt;
        else paymentMethods.card += amt;
      });
    });

    currentSessions.forEach((s) => {
      s.payments.forEach((p) => {
        const m = (p.method || '').toUpperCase();
        const amt = Number(p.amount);
        if (m === 'CASH') paymentMethods.cash += amt;
        else if (m === 'UPI') paymentMethods.upi += amt;
        else if (m === 'MIXED') paymentMethods.mixed += amt;
        else paymentMethods.card += amt;
      });
    });

    // Today's Operational Stats
    const todayFoodRev = todayOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    let todayTrampolineRev = 0;
    let todayCoinGamesRev = 0;
    let todayCompletedSessions = 0;

    todaySessions.forEach((s) => {
      const amt = Number(s.grandTotal);
      if (isTrampoline(s)) {
        todayTrampolineRev += amt;
      } else {
        todayCoinGamesRev += amt;
      }
      if (s.status === 'COMPLETED') {
        todayCompletedSessions += 1;
      }
    });

    const todaySummary = {
      totalRevenue: todayFoodRev + todayTrampolineRev + todayCoinGamesRev,
      foodRevenue: todayFoodRev,
      trampolineRevenue: todayTrampolineRev,
      coinGamesRevenue: todayCoinGamesRev,
      transactions: todayOrders.length + todaySessions.length,
      activeSessions: activeSessionsNow,
      completedSessions: todayCompletedSessions,
    };

    // Recent Unified Transactions (Latest 10)
    const recentTxList: any[] = [];
    currentOrders.slice(-15).forEach((o) => {
      const pMethod = o.payments[0]?.method || 'CASH';
      const itemsDesc = o.items.map((i) => `${i.quantity}x ${i.dish?.name}`).join(', ');
      recentTxList.push({
        id: o.id,
        time: o.createdAt.toISOString(),
        customer: o.customerName || 'Dine-in Guest',
        category: 'FOOD',
        categoryLabel: 'Food',
        details: itemsDesc || 'Food Order',
        amount: Number(o.grandTotal),
        paymentMethod: pMethod,
        status: o.status,
      });
    });

    currentSessions.slice(-15).forEach((s) => {
      const isTramp = isTrampoline(s);
      const pMethod = s.payments[0]?.method || 'CASH';
      const details = isTramp
        ? `${s.duration || 30} Min (${s.adultCount || s.guestCount || 1} Adult${(s.adultCount || 1) > 1 ? 's' : ''}${s.childCount ? `, ${s.childCount} Child` : ''})`
        : (s.pricing?.name || s.notes || 'Coin Game Pack');

      recentTxList.push({
        id: s.id,
        time: s.entryTime.toISOString(),
        customer: s.customer?.name || 'Walk-in Guest',
        category: isTramp ? 'TRAMPOLINE' : 'COIN_GAMES',
        categoryLabel: isTramp ? 'Trampoline' : 'Coin Games',
        details,
        amount: Number(s.grandTotal),
        paymentMethod: pMethod,
        status: s.status,
      });
    });

    recentTxList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      period,
      periodLabel,
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
      kpis: {
        totalRevenue,
        foodSales: foodRevenue,
        trampolineSales: trampolineRevenue,
        coinGamesSales: coinGamesRevenue,
        totalTransactions,
        foodOrdersCount,
        trampolineSessionsCount,
        coinGamesTransactionsCount,
        averageTransactionValue,
        growth: revenueGrowth,
        mix: revenueMix,
      },
      trendSeries,
      trampolineAnalytics: {
        revenue: trampolineRevenue,
        sessions: trampolineSessionsCount,
        adults: trampolineAdults,
        children: trampolineChildren,
        averageSessionValue: trampolineSessionsCount > 0 ? Math.round(trampolineRevenue / trampolineSessionsCount) : 0,
      },
      coinGameAnalytics: {
        revenue: coinGamesRevenue,
        transactions: coinGamesTransactionsCount,
        coinsSold: totalCoinsSold,
        packages: Object.values(coinPackageBreakdown).filter((p) => p.sales > 0 || p.price > 0),
      },
      foodAnalytics: {
        revenue: foodRevenue,
        orders: foodOrdersCount,
        averageOrderValue: foodOrdersCount > 0 ? Math.round(foodRevenue / foodOrdersCount) : 0,
        topItems: topFoodItems,
      },
      paymentMethods,
      todaySummary,
      recentTransactions: recentTxList.slice(0, 10),
    };
  }
}
