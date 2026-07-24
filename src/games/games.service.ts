import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {
  CreateGameDto,
  UpdateGameDto,
  CreatePricingDto,
  UpdatePricingDto,
  CreateCustomerDto,
  CreateSessionDto,
  CloseSessionDto,
  CreatePaymentDto,
} from './dto/games.dto';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 1. GAME CATALOG CRUD
  // ==========================================

  async getGames() {
    return this.prisma.game.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createGame(dto: CreateGameDto) {
    const existing = await this.prisma.game.findUnique({
      where: { name: dto.name },
    });
    if (existing && existing.deletedAt === null) {
      throw new BadRequestException('Game name already exists');
    }
    return this.prisma.game.create({
      data: {
        name: dto.name,
        description: dto.description || null,
      },
    });
  }

  async updateGame(id: string, dto: UpdateGameDto) {
    const game = await this.prisma.game.findFirst({
      where: { id, deletedAt: null },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return this.prisma.game.update({
      where: { id },
      data: dto,
    });
  }

  async deleteGame(id: string) {
    const game = await this.prisma.game.findFirst({
      where: { id, deletedAt: null },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return this.prisma.game.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // 2. PRICING PACKAGES CRUD
  // ==========================================

  async getPricings() {
    return this.prisma.gamePricing.findMany({
      where: { isActive: true },
      include: { game: true },
      orderBy: { price: 'asc' },
    });
  }

  async createPricing(dto: CreatePricingDto) {
    const game = await this.prisma.game.findFirst({
      where: { id: dto.gameId, deletedAt: null },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return this.prisma.gamePricing.create({
      data: {
        gameId: dto.gameId,
        name: dto.name,
        duration: dto.duration,
        price: dto.price,
      },
    });
  }

  async updatePricing(id: string, dto: UpdatePricingDto) {
    const pricing = await this.prisma.gamePricing.findUnique({
      where: { id },
    });
    if (!pricing) {
      throw new NotFoundException('Pricing package not found');
    }
    return this.prisma.gamePricing.update({
      where: { id },
      data: dto,
    });
  }

  async deletePricing(id: string) {
    const pricing = await this.prisma.gamePricing.findUnique({
      where: { id },
    });
    if (!pricing) {
      throw new NotFoundException('Pricing package not found');
    }
    return this.prisma.gamePricing.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==========================================
  // 3. CUSTOMER MANAGEMENT
  // ==========================================

  async getCustomers() {
    const list = await this.prisma.gameCustomer.findMany({
      include: {
        sessions: {
          include: { payments: true, game: true },
        },
      },
    });

    return list.map((c) => {
      let totalSpent = 0;
      let totalVisits = c.sessions.length;
      let lastVisit: Date | null = null;
      let gameCounts: Record<string, { name: string; count: number }> = {};
      let activeSessionId: string | null = null;

      c.sessions.forEach((s) => {
        if (s.status === 'ACTIVE') {
          activeSessionId = s.id;
        }
        const paid = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        totalSpent += paid;

        if (!lastVisit || s.entryTime > lastVisit) {
          lastVisit = s.entryTime;
        }

        if (!gameCounts[s.gameId]) {
          gameCounts[s.gameId] = { name: s.game.name, count: 0 };
        }
        gameCounts[s.gameId].count += 1;
      });

      const sortedGames = Object.values(gameCounts).sort((a, b) => b.count - a.count);
      const favoriteGame = sortedGames.length > 0 ? sortedGames[0].name : 'None';

      return {
        id: c.id,
        name: c.name,
        mobile: c.mobile,
        age: c.age,
        gender: c.gender,
        totalVisits,
        totalRevenue: totalSpent,
        favoriteGame,
        lastVisit,
        activeSession: activeSessionId,
      };
    });
  }

  async searchCustomer(mobile: string) {
    const c = await this.prisma.gameCustomer.findUnique({
      where: { mobile },
      include: {
        sessions: {
          include: { payments: true },
        },
      },
    });

    if (!c) {
      return null;
    }

    const totalSpent = c.sessions.reduce((sum, s) => {
      return sum + s.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
    }, 0);

    const active = c.sessions.find((s) => s.status === 'ACTIVE');

    return {
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      age: c.age,
      gender: c.gender,
      previousVisits: c.sessions.length,
      lastVisit: c.sessions.length > 0 ? c.sessions[c.sessions.length - 1].entryTime : null,
      totalSpent,
      currentActiveSession: active ? active.id : null,
    };
  }

  async createCustomer(dto: CreateCustomerDto) {
    const existing = await this.prisma.gameCustomer.findUnique({
      where: { mobile: dto.mobile },
    });
    if (existing) {
      throw new BadRequestException('Customer with this mobile already exists');
    }
    return this.prisma.gameCustomer.create({
      data: dto,
    });
  }

  // ==========================================
  // 4. GAME SESSIONS
  // ==========================================

  async getActiveSessions() {
    const list = await this.prisma.gameSession.findMany({
      where: { status: 'ACTIVE' },
      include: { customer: true, game: true, pricing: true },
      orderBy: { entryTime: 'desc' },
    });

    return list.map((s) => ({
      ...s,
      originalPrice: Number(s.originalPrice),
      discount: Number(s.discount),
      extraCharges: Number(s.extraCharges),
      gst: Number(s.gst),
      grandTotal: Number(s.grandTotal),
    }));
  }

  async getCompletedSessions() {
    const list = await this.prisma.gameSession.findMany({
      where: { status: 'COMPLETED' },
      include: { customer: true, game: true, pricing: true },
      orderBy: { exitTime: 'desc' },
      take: 50,
    });

    return list.map((s) => ({
      ...s,
      originalPrice: Number(s.originalPrice),
      discount: Number(s.discount),
      extraCharges: Number(s.extraCharges),
      gst: Number(s.gst),
      grandTotal: Number(s.grandTotal),
    }));
  }

  async getSession(id: string) {
    const s = await this.prisma.gameSession.findUnique({
      where: { id },
      include: { customer: true, game: true, pricing: true, payments: true, invoices: true },
    });
    if (!s) {
      throw new NotFoundException('Session not found');
    }
    const paid = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(s.grandTotal);

    return {
      ...s,
      originalPrice: Number(s.originalPrice),
      discount: Number(s.discount),
      extraCharges: Number(s.extraCharges),
      gst: Number(s.gst),
      grandTotal: total,
      paidAmount: paid,
      balanceAmount: Math.max(0, total - paid),
    };
  }

  async startSession(cashierId: string, cashierRole: string, dto: CreateSessionDto) {
    const customer = await this.prisma.gameCustomer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    const game = await this.prisma.game.findFirst({
      where: { id: dto.gameId, deletedAt: null },
    });
    if (!game) {
      throw new NotFoundException('Game catalog entry not found');
    }

    const pricing = await this.prisma.gamePricing.findUnique({
      where: { id: dto.pricingId },
    });
    if (!pricing) {
      throw new NotFoundException('Pricing package not found');
    }

    // 1. Manager Override validation
    const discount = Number(dto.discount || 0);
    let isOverridden = false;
    let overrideUserName: string | null = null;

    if (discount > 0) {
      if (cashierRole === 'ADMIN' || cashierRole === 'MANAGER') {
        // managers can self-approve discount overrides
        isOverridden = true;
        const selfUser = await this.prisma.user.findUnique({ where: { id: cashierId } });
        overrideUserName = selfUser?.name || 'Manager';
      } else {
        // cashiers must present manager authentication payload
        if (!dto.overrideAuth) {
          throw new BadRequestException('Manager override credentials are required for discounts');
        }
        const manager = await this.prisma.user.findUnique({
          where: { email: dto.overrideAuth.username },
        });
        if (!manager || !manager.isActive) {
          throw new BadRequestException('Manager account not found or disabled');
        }
        if (manager.role !== 'ADMIN' && manager.role !== 'MANAGER') {
          throw new BadRequestException('Authorized user must be an Admin or Manager');
        }
        const match = await bcrypt.compare(dto.overrideAuth.password, manager.passwordHash);
        if (!match) {
          throw new BadRequestException('Invalid manager password credentials');
        }
        isOverridden = true;
        overrideUserName = manager.name;
      }
    }

    // 2. Pricing Calculations
    const originalPrice = Number(pricing.price) * Number(dto.guestCount || 1);
    const subtotal = Math.max(0, originalPrice - discount);
    const gstRate = Number(dto.gst || 0);
    const grandTotal = Math.max(0, subtotal + gstRate);

    // 3. Create Session inside Prisma Transaction
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.create({
        data: {
          customerId: customer.id,
          gameId: game.id,
          pricingId: pricing.id,
          guestCount: dto.guestCount,
          status: 'ACTIVE',
          originalPrice,
          discount,
          gst: gstRate,
          grandTotal,
          overrideUser: overrideUserName,
          overrideReason: dto.overrideAuth?.reason || (discount > 0 ? 'Manager Discount self-approved' : null),
          notes: dto.notes || null,
        },
      });

      // Log Payment if any is collected immediately
      if (dto.amountPaid && dto.amountPaid > 0) {
        await tx.gamePayment.create({
          data: {
            sessionId: session.id,
            amount: dto.amountPaid,
            method: dto.paymentMethod || 'CASH',
            notes: 'Advance checkout payment received',
            date: new Date(),
          },
        });
      }

      // Log Activity
      await tx.gameActivityLog.create({
        data: {
          userId: cashierId,
          sessionId: session.id,
          action: 'CREATE_SESSION',
          details: `Session started for customer ${customer.name} for game ${game.name}. Package: ${pricing.name}. Paid: ₹${dto.amountPaid || 0}`,
        },
      });

      if (isOverridden) {
        await tx.gameActivityLog.create({
          data: {
            userId: cashierId,
            sessionId: session.id,
            action: 'PRICE_OVERRIDE',
            details: `Price override approved by ${overrideUserName}. Discount: ₹${discount}. Reason: ${dto.overrideAuth?.reason || 'Self-approved discount'}`,
          },
        });
      }

      return session;
    });
  }

  async closeSession(id: string, dto: CloseSessionDto, userId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id },
      include: { customer: true, game: true, pricing: true, payments: true },
    });
    if (!session) {
      throw new NotFoundException('Active session not found');
    }
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is already closed');
    }

    const exitTime = new Date();
    const entryTime = new Date(session.entryTime);
    
    // Calculate actual elapsed minutes
    const actualDuration = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 1000 / 60));

    // Overtime Calculations if package has duration
    const packageDuration = session.pricing.duration;
    const packagePrice = Number(session.originalPrice);
    
    let calculatedExtraCharges = 0;
    if (packageDuration > 0 && actualDuration > packageDuration) {
      const overtime = actualDuration - packageDuration;
      if (overtime > 5) { // 5-minute grace period
        // Proportional overtime rate calculation
        const baseRatePerMin = packagePrice / packageDuration;
        calculatedExtraCharges = Math.round(baseRatePerMin * overtime);
      }
    }

    // Cashier can pass custom extra charges (overrides)
    const extraCharges = dto.extraCharges !== undefined ? dto.extraCharges : calculatedExtraCharges;
    const additionalDiscount = Number(dto.discount || 0);

    const prevPaymentsSum = session.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const subtotal = Number(session.originalPrice) - Number(session.discount) - additionalDiscount + extraCharges;
    const gstRate = Math.round(subtotal * 0.18); // standard 18% GST recalculate
    const grandTotal = Math.max(0, subtotal + gstRate);
    const balanceDue = Math.max(0, grandTotal - prevPaymentsSum);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.gameSession.update({
        where: { id },
        data: {
          exitTime,
          status: 'COMPLETED',
          extraCharges,
          discount: Number(session.discount) + additionalDiscount,
          gst: gstRate,
          grandTotal,
        },
      });

      // Record closing payment if balance collected
      if (dto.amountPaid && dto.amountPaid > 0) {
        await tx.gamePayment.create({
          data: {
            sessionId: id,
            amount: dto.amountPaid,
            method: dto.paymentMethod || 'CASH',
            notes: 'Final settlement payment received upon session close',
            date: new Date(),
          },
        });
      }

      // Generate Invoice
      await tx.gameInvoice.create({
        data: {
          sessionId: id,
        },
      });

      // Log Activity
      await tx.gameActivityLog.create({
        data: {
          userId,
          sessionId: id,
          action: 'CLOSE_SESSION',
          details: `Session closed for customer ${session.customer.name}. Actual duration: ${actualDuration}m. Extra charges: ₹${extraCharges}. Paid: ₹${dto.amountPaid || 0}`,
        },
      });

      return updated;
    });
  }

  // ==========================================
  // 5. GENERAL PAYMENTS LEDGER
  // ==========================================

  async getPayments() {
    const list = await this.prisma.gamePayment.findMany({
      include: {
        session: {
          include: { customer: true, game: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));
  }

  async addPayment(sessionId: string, dto: { amount: number; method: string; notes?: string }, userId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { customer: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.gamePayment.create({
        data: {
          sessionId,
          amount: dto.amount,
          method: dto.method,
          notes: dto.notes || null,
        },
      });

      await tx.gameActivityLog.create({
        data: {
          userId,
          sessionId,
          action: 'RECORD_PAYMENT',
          details: `Collected payment of ₹${dto.amount} via ${dto.method} for customer ${session.customer.name}`,
        },
      });

      return payment;
    });
  }

  // ==========================================
  // 6. ANALYTICS & REPORTS
  // ==========================================

  async getReports(start: string, end: string) {
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Fetch Payments in range
    const payments = await this.prisma.gamePayment.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: {
        session: {
          include: { customer: true, game: true },
        },
      },
    });

    // Fetch Sessions in range
    const sessions = await this.prisma.gameSession.findMany({
      where: { entryTime: { gte: startDate, lte: endDate } },
      include: { customer: true, game: true, pricing: true },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const activeCount = sessions.filter((s) => s.status === 'ACTIVE').length;
    const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;

    // Daily Revenue Grouping
    const dailyRevenue: Record<string, number> = {};
    payments.forEach((p) => {
      const dateStr = p.date.toISOString().split('T')[0];
      dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + Number(p.amount);
    });

    const revenueReport = Object.entries(dailyRevenue).map(([date, total]) => ({
      date,
      total,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Game Revenue & count Grouping
    const gameUtilization: Record<string, { name: string; count: number; revenue: number }> = {};
    sessions.forEach((s) => {
      if (s.status === 'CANCELLED') return;
      if (!gameUtilization[s.gameId]) {
        gameUtilization[s.gameId] = { name: s.game.name, count: 0, revenue: 0 };
      }
      gameUtilization[s.gameId].count += 1;
      gameUtilization[s.gameId].revenue += Number(s.grandTotal);
    });

    // Peak Hour Grouping (entry times)
    const hourlyVisits: Record<number, number> = {};
    sessions.forEach((s) => {
      const hr = new Date(s.entryTime).getHours();
      hourlyVisits[hr] = (hourlyVisits[hr] || 0) + 1;
    });

    const peakHoursReport = Object.entries(hourlyVisits).map(([hour, count]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      count,
    })).sort((a, b) => a.hour.localeCompare(b.hour));

    // Average Session Duration
    let totalDurations = 0;
    let countedCompleted = 0;
    sessions.forEach((s) => {
      if (s.status === 'COMPLETED' && s.exitTime) {
        const diff = Math.round((new Date(s.exitTime).getTime() - new Date(s.entryTime).getTime()) / 1000 / 60);
        totalDurations += diff;
        countedCompleted++;
      }
    });
    const averageSessionTime = countedCompleted > 0 ? Math.round(totalDurations / countedCompleted) : 0;

    return {
      summary: {
        totalRevenue,
        activeCount,
        completedCount,
        averageSessionTime,
      },
      revenueReport,
      gameUtilization: Object.values(gameUtilization),
      peakHours: peakHoursReport,
      sessionsList: sessions.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        customerName: s.customer.name,
        gameName: s.game.name,
        entryTime: s.entryTime,
        exitTime: s.exitTime,
        status: s.status,
        grandTotal: Number(s.grandTotal),
      })),
    };
  }

  // ==========================================
  // 7. SYSTEM STATS (DASHBOARD HIGHLIGHTS)
  // ==========================================

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Visitors today
    const sessionsToday = await this.prisma.gameSession.findMany({
      where: { entryTime: { gte: today, lt: tomorrow } },
    });
    const visitorsToday = sessionsToday.reduce((sum, s) => sum + s.guestCount, 0);

    // Revenue today
    const todayPayments = await this.prisma.gamePayment.findMany({
      where: { date: { gte: today, lt: tomorrow } },
    });
    const todayRevenue = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Sessions count
    const activeSessionsCount = sessionsToday.filter((s) => s.status === 'ACTIVE').length;
    const completedSessionsCount = sessionsToday.filter((s) => s.status === 'COMPLETED').length;

    // Pending payments calculations
    const activeSessions = await this.prisma.gameSession.findMany({
      where: { status: 'ACTIVE' },
      include: { payments: true },
    });
    let pendingPaymentsCount = 0;
    activeSessions.forEach((s) => {
      const paid = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      if (Number(s.grandTotal) - paid > 0.05) {
        pendingPaymentsCount++;
      }
    });

    // Average session time today
    let totalDurations = 0;
    let completedCount = 0;
    sessionsToday.forEach((s) => {
      if (s.status === 'COMPLETED' && s.exitTime) {
        const diff = Math.round((new Date(s.exitTime).getTime() - new Date(s.entryTime).getTime()) / 1000 / 60);
        totalDurations += diff;
        completedCount++;
      }
    });
    const avgSessionTime = completedCount > 0 ? Math.round(totalDurations / completedCount) : 0;

    // Recent Sessions
    const recentSessionsList = await this.prisma.gameSession.findMany({
      include: { customer: true, game: true, pricing: true },
      orderBy: { entryTime: 'desc' },
      take: 5,
    });

    return {
      todayVisitors: visitorsToday,
      todayRevenue,
      activeSessions: activeSessionsCount,
      completedSessions: completedSessionsCount,
      pendingPayments: pendingPaymentsCount,
      averageSessionTime: avgSessionTime,
      recentSessions: recentSessionsList.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        customerName: s.customer.name,
        gameName: s.game.name,
        packageName: s.pricing.name,
        entryTime: s.entryTime,
        status: s.status,
        grandTotal: Number(s.grandTotal),
      })),
    };
  }
}
