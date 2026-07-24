import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateHallDto,
  UpdateHallDto,
  CreateBookingDto,
  UpdateBookingStatusDto,
  CreatePaymentDto,
} from './dto/party-hall.dto';

@Injectable()
export class PartyHallService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 1. HALL CRUD OPERATIONS
  // ==========================================

  async getHalls() {
    return this.prisma.partyHall.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createHall(dto: CreateHallDto) {
    const existing = await this.prisma.partyHall.findUnique({
      where: { name: dto.name },
    });
    if (existing && existing.deletedAt === null) {
      throw new BadRequestException('Hall name already exists');
    }
    return this.prisma.partyHall.create({
      data: {
        name: dto.name,
        capacity: dto.capacity,
        baseRent: dto.baseRent,
        description: dto.description || null,
      },
    });
  }

  async updateHall(id: string, dto: UpdateHallDto) {
    const hall = await this.prisma.partyHall.findFirst({
      where: { id, deletedAt: null },
    });
    if (!hall) {
      throw new NotFoundException('Hall not found');
    }
    return this.prisma.partyHall.update({
      where: { id },
      data: dto,
    });
  }

  async deleteHall(id: string) {
    const hall = await this.prisma.partyHall.findFirst({
      where: { id, deletedAt: null },
    });
    if (!hall) {
      throw new NotFoundException('Hall not found');
    }
    return this.prisma.partyHall.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==========================================
  // 2. DASHBOARD STATS
  // ==========================================

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Today's Bookings
    const todayBookings = await this.prisma.partyHallBooking.findMany({
      where: {
        bookingDate: { gte: today, lt: tomorrow },
        status: { in: ['BOOKED', 'RESERVED'] },
      },
      include: { customer: true, hall: true },
    });

    // Upcoming Events
    const upcomingEvents = await this.prisma.partyHallBooking.findMany({
      where: {
        bookingDate: { gte: today },
        status: { in: ['BOOKED', 'RESERVED'] },
      },
      include: { customer: true, hall: true },
      orderBy: { bookingDate: 'asc' },
      take: 10,
    });

    // Today's Revenue (payments received today)
    const todayPayments = await this.prisma.partyHallPayment.findMany({
      where: { date: { gte: today, lt: tomorrow } },
    });
    const todayRevenue = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Monthly Revenue (payments received this month)
    const monthlyPayments = await this.prisma.partyHallPayment.findMany({
      where: { date: { gte: firstDayOfMonth, lt: tomorrow } },
    });
    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Total active bookings
    const bookingsForPending = await this.prisma.partyHallBooking.findMany({
      where: { status: { in: ['BOOKED', 'RESERVED'] } },
      include: { payments: true },
    });

    // Pending payments calculations
    let pendingPaymentsCount = 0;
    bookingsForPending.forEach((b) => {
      const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const total = Number(b.grandTotal);
      if (total - paid > 0.05) {
        pendingPaymentsCount++;
      }
    });

    // Hall occupancy
    const totalHalls = await this.prisma.partyHall.count({
      where: { deletedAt: null, isActive: true },
    });
    const occupiedHallsToday = todayBookings.length;
    const hallOccupancy = totalHalls > 0 ? Math.round((occupiedHallsToday / totalHalls) * 100) : 0;

    // Recent Payments
    const recentPayments = await this.prisma.partyHallPayment.findMany({
      include: {
        booking: {
          include: { customer: true, hall: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Recent Bookings
    const recentBookings = await this.prisma.partyHallBooking.findMany({
      include: { customer: true, hall: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      todayBookingsCount: todayBookings.length,
      upcomingEventsCount: upcomingEvents.length,
      pendingPaymentsCount,
      todayRevenue,
      monthlyRevenue,
      hallOccupancy,
      upcomingEvents: upcomingEvents.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        customerName: b.customer.name,
        customerMobile: b.customer.mobile,
        hallName: b.hall.name,
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        eventType: b.eventType,
        status: b.status,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        date: p.date,
        customerName: p.booking.customer.name,
        hallName: p.booking.hall.name,
        bookingNumber: p.booking.bookingNumber,
      })),
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        customerName: b.customer.name,
        hallName: b.hall.name,
        bookingDate: b.bookingDate,
        grandTotal: Number(b.grandTotal),
        status: b.status,
      })),
    };
  }

  // ==========================================
  // 3. BOOKINGS MANAGEMENT
  // ==========================================

  async getBookings() {
    const list = await this.prisma.partyHallBooking.findMany({
      include: {
        customer: true,
        hall: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((b) => {
      const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const total = Number(b.grandTotal);
      return {
        ...b,
        hallRent: Number(b.hallRent),
        decorCharges: Number(b.decorCharges),
        foodCharges: Number(b.foodCharges),
        soundCharges: Number(b.soundCharges),
        generatorCharges: Number(b.generatorCharges),
        cleaningCharges: Number(b.cleaningCharges),
        extraCharges: Number(b.extraCharges),
        discount: Number(b.discount),
        gst: Number(b.gst),
        grandTotal: total,
        advancePaid: paid,
        balanceAmount: total - paid,
      };
    });
  }

  async getBooking(id: string) {
    const b = await this.prisma.partyHallBooking.findUnique({
      where: { id },
      include: {
        customer: true,
        hall: true,
        services: true,
        payments: true,
        invoices: true,
      },
    });
    if (!b) {
      throw new NotFoundException('Booking not found');
    }

    const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(b.grandTotal);

    return {
      ...b,
      hallRent: Number(b.hallRent),
      decorCharges: Number(b.decorCharges),
      foodCharges: Number(b.foodCharges),
      soundCharges: Number(b.soundCharges),
      generatorCharges: Number(b.generatorCharges),
      cleaningCharges: Number(b.cleaningCharges),
      extraCharges: Number(b.extraCharges),
      discount: Number(b.discount),
      gst: Number(b.gst),
      grandTotal: total,
      advancePaid: paid,
      balanceAmount: total - paid,
    };
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const hall = await this.prisma.partyHall.findFirst({
      where: { id: dto.hallId, deletedAt: null },
    });
    if (!hall) {
      throw new NotFoundException('Party hall not found');
    }

    // 1. Manage Customer
    let customer = await this.prisma.partyHallCustomer.findUnique({
      where: { mobile: dto.customerMobile },
    });
    if (!customer) {
      customer = await this.prisma.partyHallCustomer.create({
        data: {
          name: dto.customerName,
          mobile: dto.customerMobile,
          altMobile: dto.customerAltMobile || null,
          email: dto.customerEmail || null,
          address: dto.customerAddress || null,
        },
      });
    } else {
      // Update customer details if they changed
      customer = await this.prisma.partyHallCustomer.update({
        where: { id: customer.id },
        data: {
          name: dto.customerName,
          altMobile: dto.customerAltMobile || customer.altMobile,
          email: dto.customerEmail || customer.email,
          address: dto.customerAddress || customer.address,
        },
      });
    }

    // 2. Calculations
    const hallRent = Number(dto.decorCharges || 0) === 0 && Number(dto.foodCharges || 0) === 0
      ? Number(hall.baseRent) // default to base rent if custom is not provided
      : Number(hall.baseRent);

    const decor = Number(dto.decorCharges || 0);
    const food = Number(dto.foodCharges || 0);
    const sound = Number(dto.soundCharges || 0);
    const gen = Number(dto.generatorCharges || 0);
    const cleaning = Number(dto.cleaningCharges || 0);
    const extra = Number(dto.extraCharges || 0);
    const discount = Number(dto.discount || 0);

    const subtotal = hallRent + decor + food + sound + gen + cleaning + extra;
    const gstRate = Number(dto.gst || 0); // direct amount or percentage, let's treat it as direct amount passed from UI calculations
    const grandTotal = Math.max(0, subtotal + gstRate - discount);

    // 3. Create Booking Transaction
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.partyHallBooking.create({
        data: {
          customerId: customer.id,
          hallId: hall.id,
          eventType: dto.eventType,
          bookingDate: new Date(dto.bookingDate),
          startTime: dto.startTime,
          endTime: dto.endTime,
          guestCount: dto.guestCount,
          status: dto.advancePaid && dto.advancePaid > 0 ? 'BOOKED' : 'RESERVED',
          hallRent,
          decorCharges: decor,
          foodCharges: food,
          soundCharges: sound,
          generatorCharges: gen,
          cleaningCharges: cleaning,
          extraCharges: extra,
          discount,
          gst: gstRate,
          grandTotal,
          notes: dto.notes || null,
        },
      });

      // Write services if any
      const servicesToCreate: any[] = [];
      if (decor > 0) servicesToCreate.push({ name: 'Decoration', cost: decor });
      if (food > 0) servicesToCreate.push({ name: 'Catering', cost: food });
      if (sound > 0) servicesToCreate.push({ name: 'Sound System', cost: sound });
      if (gen > 0) servicesToCreate.push({ name: 'Generator', cost: gen });
      if (cleaning > 0) servicesToCreate.push({ name: 'Cleaning', cost: cleaning });

      // Custom services if provided
      if (dto.services && dto.services.length > 0) {
        dto.services.forEach((s) => {
          servicesToCreate.push({ name: s.name, cost: s.cost });
        });
      }

      if (servicesToCreate.length > 0) {
        await tx.partyHallService.createMany({
          data: servicesToCreate.map((s) => ({
            bookingId: booking.id,
            name: s.name,
            cost: s.cost,
          })),
        });
      }

      // Handle Advance payment
      if (dto.advancePaid && dto.advancePaid > 0) {
        await tx.partyHallPayment.create({
          data: {
            bookingId: booking.id,
            amount: dto.advancePaid,
            method: 'CASH', // default advance method
            notes: 'Advance Payment received during booking creation',
            date: new Date(),
          },
        });
      }

      // Log Activity
      await tx.partyHallActivityLog.create({
        data: {
          userId,
          action: 'CREATE_BOOKING',
          details: `Booking #${booking.bookingNumber} created for customer ${customer.name}. Grand Total: ₹${grandTotal}`,
        },
      });

      return booking;
    });
  }

  async updateBookingStatus(id: string, dto: UpdateBookingStatusDto, userId: string) {
    const booking = await this.prisma.partyHallBooking.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const updated = await this.prisma.partyHallBooking.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.prisma.partyHallActivityLog.create({
      data: {
        userId,
        action: 'UPDATE_BOOKING_STATUS',
        details: `Booking #${booking.bookingNumber} status updated to ${dto.status}.`,
      },
    });

    return updated;
  }

  async updateBooking(id: string, dto: CreateBookingDto, userId: string) {
    const booking = await this.prisma.partyHallBooking.findUnique({
      where: { id },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const hall = await this.prisma.partyHall.findFirst({
      where: { id: dto.hallId, deletedAt: null },
    });
    if (!hall) {
      throw new NotFoundException('Party hall not found');
    }

    // 1. Manage Customer
    let customer = await this.prisma.partyHallCustomer.findUnique({
      where: { mobile: dto.customerMobile },
    });
    if (!customer) {
      customer = await this.prisma.partyHallCustomer.create({
        data: {
          name: dto.customerName,
          mobile: dto.customerMobile,
          altMobile: dto.customerAltMobile || null,
          email: dto.customerEmail || null,
          address: dto.customerAddress || null,
        },
      });
    }

    // 2. Calculations
    const hallRent = Number(hall.baseRent);
    const decor = Number(dto.decorCharges || 0);
    const food = Number(dto.foodCharges || 0);
    const sound = Number(dto.soundCharges || 0);
    const gen = Number(dto.generatorCharges || 0);
    const cleaning = Number(dto.cleaningCharges || 0);
    const extra = Number(dto.extraCharges || 0);
    const discount = Number(dto.discount || 0);

    const subtotal = hallRent + decor + food + sound + gen + cleaning + extra;
    const gstRate = Number(dto.gst || 0);
    const grandTotal = Math.max(0, subtotal + gstRate - discount);

    return this.prisma.$transaction(async (tx) => {
      // Clear existing services to rewrite
      await tx.partyHallService.deleteMany({
        where: { bookingId: id },
      });

      const updated = await tx.partyHallBooking.update({
        where: { id },
        data: {
          customerId: customer.id,
          hallId: hall.id,
          eventType: dto.eventType,
          bookingDate: new Date(dto.bookingDate),
          startTime: dto.startTime,
          endTime: dto.endTime,
          guestCount: dto.guestCount,
          hallRent,
          decorCharges: decor,
          foodCharges: food,
          soundCharges: sound,
          generatorCharges: gen,
          cleaningCharges: cleaning,
          extraCharges: extra,
          discount,
          gst: gstRate,
          grandTotal,
          notes: dto.notes || null,
        },
      });

      // Write services if any
      const servicesToCreate: any[] = [];
      if (decor > 0) servicesToCreate.push({ name: 'Decoration', cost: decor });
      if (food > 0) servicesToCreate.push({ name: 'Catering', cost: food });
      if (sound > 0) servicesToCreate.push({ name: 'Sound System', cost: sound });
      if (gen > 0) servicesToCreate.push({ name: 'Generator', cost: gen });
      if (cleaning > 0) servicesToCreate.push({ name: 'Cleaning', cost: cleaning });

      if (dto.services && dto.services.length > 0) {
        dto.services.forEach((s) => {
          servicesToCreate.push({ name: s.name, cost: s.cost });
        });
      }

      if (servicesToCreate.length > 0) {
        await tx.partyHallService.createMany({
          data: servicesToCreate.map((s) => ({
            bookingId: id,
            name: s.name,
            cost: s.cost,
          })),
        });
      }

      // Log Activity
      await tx.partyHallActivityLog.create({
        data: {
          userId,
          action: 'UPDATE_BOOKING',
          details: `Booking #${booking.bookingNumber} details updated. Grand Total: ₹${grandTotal}`,
        },
      });

      return updated;
    });
  }

  // ==========================================
  // 4. PAYMENTS & INVOICES
  // ==========================================

  async addPayment(bookingId: string, dto: CreatePaymentDto, userId: string) {
    const booking = await this.prisma.partyHallBooking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const totalPaid = booking.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Number(booking.grandTotal) - totalPaid;

    if (dto.amount > balance + 0.05) {
      throw new BadRequestException(`Payment amount ₹${dto.amount} exceeds pending balance ₹${balance}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.partyHallPayment.create({
        data: {
          bookingId,
          amount: dto.amount,
          method: dto.method,
          notes: dto.notes || null,
          date: new Date(),
        },
      });

      // Update status if fully paid or booked
      let newStatus = booking.status;
      if (totalPaid + dto.amount >= Number(booking.grandTotal) - 0.05) {
        newStatus = 'BOOKED'; // Mark as fully confirmed if fully paid or booked
      }

      await tx.partyHallBooking.update({
        where: { id: bookingId },
        data: { status: newStatus },
      });

      await tx.partyHallActivityLog.create({
        data: {
          userId,
          action: 'RECORD_PAYMENT',
          details: `Recorded payment of ₹${dto.amount} for Booking #${booking.bookingNumber} using ${dto.method}`,
        },
      });

      return payment;
    });
  }

  async getPayments() {
    return this.prisma.partyHallPayment.findMany({
      include: {
        booking: {
          include: { customer: true, hall: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaymentsForBooking(bookingId: string) {
    return this.prisma.partyHallPayment.findMany({
      where: { bookingId },
      orderBy: { date: 'asc' },
    });
  }

  async createInvoice(bookingId: string, userId: string) {
    const booking = await this.prisma.partyHallBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if invoice already exists
    const existing = await this.prisma.partyHallInvoice.findFirst({
      where: { bookingId },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.partyHallInvoice.create({
        data: {
          bookingId,
        },
      });

      await tx.partyHallActivityLog.create({
        data: {
          userId,
          action: 'GENERATE_INVOICE',
          details: `Generated Invoice #${invoice.invoiceNumber} for Booking #${booking.bookingNumber}`,
        },
      });

      return invoice;
    });
  }

  async getInvoices() {
    return this.prisma.partyHallInvoice.findMany({
      include: {
        booking: {
          include: { customer: true, hall: true, payments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoicesForBooking(bookingId: string) {
    return this.prisma.partyHallInvoice.findMany({
      where: { bookingId },
    });
  }

  // ==========================================
  // 5. CUSTOMER DIRECTORIES
  // ==========================================

  async getCustomers() {
    const customers = await this.prisma.partyHallCustomer.findMany({
      include: {
        bookings: {
          include: { payments: true },
        },
      },
    });

    return customers.map((c) => {
      let totalRevenue = 0;
      let totalBookings = c.bookings.length;
      let pendingBalance = 0;

      c.bookings.forEach((b) => {
        const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        totalRevenue += paid;
        if (b.status !== 'CANCELLED') {
          pendingBalance += Math.max(0, Number(b.grandTotal) - paid);
        }
      });

      return {
        id: c.id,
        name: c.name,
        mobile: c.mobile,
        altMobile: c.altMobile,
        email: c.email,
        address: c.address,
        totalBookings,
        totalRevenue,
        pendingBalance,
        bookings: c.bookings.map((b) => ({
          id: b.id,
          bookingNumber: b.bookingNumber,
          bookingDate: b.bookingDate,
          eventType: b.eventType,
          grandTotal: Number(b.grandTotal),
          status: b.status,
        })),
      };
    });
  }

  // ==========================================
  // 6. REPORTS
  // ==========================================

  async getReports(start: string, end: string) {
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Bookings list
    const bookings = await this.prisma.partyHallBooking.findMany({
      where: {
        bookingDate: { gte: startDate, lte: endDate },
      },
      include: { customer: true, hall: true, payments: true },
    });

    // Payments logs
    const payments = await this.prisma.partyHallPayment.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      include: {
        booking: {
          include: { customer: true, hall: true },
        },
      },
    });

    // Revenue totals
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalBookingsCount = bookings.filter((b) => b.status !== 'CANCELLED').length;
    const cancelledCount = bookings.filter((b) => b.status === 'CANCELLED').length;

    // Daily revenue chart grouping
    const dailyRevenue: Record<string, number> = {};
    payments.forEach((p) => {
      const dateStr = p.date.toISOString().split('T')[0];
      dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + Number(p.amount);
    });

    const revenueReport = Object.entries(dailyRevenue).map(([date, total]) => ({
      date,
      total,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Hall Utilization count
    const hallUtilization: Record<string, { name: string; count: number; revenue: number }> = {};
    bookings.forEach((b) => {
      if (b.status === 'CANCELLED') return;
      if (!hallUtilization[b.hallId]) {
        hallUtilization[b.hallId] = { name: b.hall.name, count: 0, revenue: 0 };
      }
      hallUtilization[b.hallId].count += 1;
      hallUtilization[b.hallId].revenue += Number(b.grandTotal);
    });

    // Event Types list
    const eventTypesCount: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.status === 'CANCELLED') return;
      eventTypesCount[b.eventType] = (eventTypesCount[b.eventType] || 0) + 1;
    });

    return {
      summary: {
        totalRevenue,
        bookingsCount: totalBookingsCount,
        cancelledCount,
      },
      revenueReport,
      hallUtilization: Object.values(hallUtilization),
      eventTypes: Object.entries(eventTypesCount).map(([type, count]) => ({
        type,
        count,
      })),
      bookingsList: bookings.map((b) => {
        const paid = b.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: b.id,
          bookingNumber: b.bookingNumber,
          customerName: b.customer.name,
          hallName: b.hall.name,
          bookingDate: b.bookingDate,
          eventType: b.eventType,
          grandTotal: Number(b.grandTotal),
          paid,
          balance: Number(b.grandTotal) - paid,
          status: b.status,
        };
      }),
    };
  }
}
