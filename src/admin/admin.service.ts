import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillTypeFilter, QueryBillsDto, DeleteBillDto } from './dto/admin-bills.dto';
import { OrderStatus, TableStatus } from '@prisma/client';

export interface UnifiedBill {
  id: string;
  rawId: string;
  billType: 'RESTAURANT' | 'TRAMPOLINE' | 'COIN_GAMES';
  billNumber: string;
  displayNumber: string;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: string;
  paymentBreakdown?: any;
  status: string;
  itemsCount: number;
  itemsSummary: string;
  tableOrZone: string;
  cashierOrOperator: string;
  createdAt: Date;
  isCancelled: boolean;
  cancellationReason?: string | null;
  cancelledAt?: Date | null;
  cancelledByName?: string | null;
  details: any;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUnifiedBills(query: QueryBillsDto) {
    const { startDate, endDate, type = BillTypeFilter.ALL, status, paymentMethod, search } = query;

    // 1. Date Range Construction
    const start = startDate ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate) : new Date(new Date().setHours(23, 59, 59, 999));
    end.setHours(23, 59, 59, 999);

    const bills: UnifiedBill[] = [];

    // 2. Fetch Restaurant Orders if requested
    if (type === BillTypeFilter.ALL || type === BillTypeFilter.RESTAURANT) {
      const orderWhere: any = {
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (status && status !== 'ALL') {
        orderWhere.status = status;
      }

      const orders = await this.prisma.order.findMany({
        where: orderWhere,
        include: {
          items: {
            include: {
              dish: {
                include: { category: true },
              },
            },
          },
          table: true,
          cashier: { select: { id: true, name: true, email: true } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const ord of orders) {
        let pMethod = 'CASH';
        let pDetails = null;
        if (ord.payments && ord.payments.length > 0) {
          pMethod = ord.payments[0].method;
          if (ord.payments.length > 1) {
            pMethod = 'MIXED';
          }
          pDetails = ord.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            status: p.status,
            details: p.details,
          }));
        }

        const itemsSummary = ord.items
          .map((i) => `${i.dish?.name || 'Item'} (x${i.quantity})`)
          .join(', ');

        const totalItemsCount = ord.items.reduce((sum, i) => sum + i.quantity, 0);

        bills.push({
          id: `order-${ord.id}`,
          rawId: ord.id,
          billType: 'RESTAURANT',
          billNumber: `POS-${ord.orderNumber}`,
          displayNumber: `#${ord.orderNumber}`,
          customerName: ord.customerName || 'Walk-in Guest',
          customerPhone: ord.customerPhone || '-',
          subtotal: Number(ord.subtotal),
          taxTotal: Number(ord.taxTotal),
          discountTotal: Number(ord.discountTotal || 0),
          grandTotal: Number(ord.grandTotal),
          paymentMethod: pMethod,
          paymentBreakdown: pDetails,
          status: ord.status,
          itemsCount: totalItemsCount,
          itemsSummary: itemsSummary || 'No items listed',
          tableOrZone: ord.table ? `Table ${ord.table.number}` : ord.type,
          cashierOrOperator: ord.cashier?.name || 'Cashier',
          createdAt: ord.createdAt,
          isCancelled: ord.status === OrderStatus.CANCELLED || !!ord.deletedAt,
          cancellationReason: ord.cancellationReason,
          cancelledAt: ord.cancelledAt,
          cancelledByName: ord.cancelledByName,
          details: {
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            type: ord.type,
            table: ord.table,
            cashier: ord.cashier,
            items: ord.items.map((it) => ({
              id: it.id,
              name: it.dish?.name || 'Item',
              category: it.dish?.category?.name || 'General',
              quantity: it.quantity,
              price: Number(it.price),
              taxRate: Number(it.taxRate),
              notes: it.notes,
            })),
            payments: pDetails,
          },
        });
      }
    }

    // 3. Fetch Gaming Sessions (Trampoline & Coin Games) if requested
    if (type === BillTypeFilter.ALL || type === BillTypeFilter.TRAMPOLINE || type === BillTypeFilter.COIN_GAMES) {
      const sessionWhere: any = {
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (status && status !== 'ALL') {
        sessionWhere.status = status;
      }

      const sessions = await this.prisma.gameSession.findMany({
        where: sessionWhere,
        include: {
          customer: true,
          game: true,
          pricing: true,
          payments: true,
          invoices: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const sess of sessions) {
        const gameName = (sess.game?.name || '').toLowerCase();
        const pricingName = (sess.pricing?.name || '').toLowerCase();
        const isCoinGame =
          gameName.includes('coin') ||
          pricingName.includes('coin') ||
          (sess.duration === 0 && sess.adultCount === 0 && sess.childCount === 0) ||
          sess.notes?.toLowerCase().includes('coin');

        const currentBillType: 'TRAMPOLINE' | 'COIN_GAMES' = isCoinGame ? 'COIN_GAMES' : 'TRAMPOLINE';

        // Filter if specific type requested
        if (type === BillTypeFilter.TRAMPOLINE && currentBillType !== 'TRAMPOLINE') {
          continue;
        }
        if (type === BillTypeFilter.COIN_GAMES && currentBillType !== 'COIN_GAMES') {
          continue;
        }

        let pMethod = 'CASH';
        let pDetails = null;
        if (sess.payments && sess.payments.length > 0) {
          pMethod = sess.payments[0].method;
          if (sess.payments.length > 1) {
            pMethod = 'MIXED';
          }
          pDetails = sess.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            notes: p.notes,
            date: p.date,
          }));
        }

        const invoiceNum = sess.invoices?.[0]?.invoiceNumber;
        const billNum = invoiceNum
          ? `${isCoinGame ? 'COIN' : 'TRP'}-INV-${invoiceNum}`
          : `${isCoinGame ? 'COIN' : 'TRP'}-#${sess.sessionId}`;

        let itemsSummary = '';
        let tableOrZone = '';

        if (isCoinGame) {
          itemsSummary = sess.pricing?.name || sess.notes || 'Arcade / Token Package';
          tableOrZone = 'Coin Games Zone';
        } else {
          const guests: string[] = [];
          if (sess.adultCount > 0) guests.push(`${sess.adultCount} Adults`);
          if (sess.childCount > 0) guests.push(`${sess.childCount} Kids`);
          if (guests.length === 0) guests.push(`${sess.guestCount} Guests`);
          itemsSummary = `${sess.game?.name || 'Trampoline'} (${sess.duration} Mins) - ${guests.join(', ')}`;
          tableOrZone = sess.game?.name || 'Trampoline Arena';
        }

        bills.push({
          id: `game-${sess.id}`,
          rawId: sess.id,
          billType: currentBillType,
          billNumber: billNum,
          displayNumber: `#${sess.sessionId}`,
          customerName: sess.customer?.name || sess.customer?.parentName || 'Walk-in Player',
          customerPhone: sess.customer?.mobile || '-',
          subtotal: Number(sess.originalPrice),
          taxTotal: Number(sess.gst || 0),
          discountTotal: Number(sess.discount || 0),
          grandTotal: Number(sess.grandTotal),
          paymentMethod: pMethod,
          paymentBreakdown: pDetails,
          status: sess.status,
          itemsCount: isCoinGame ? 1 : sess.guestCount || 1,
          itemsSummary,
          tableOrZone,
          cashierOrOperator: sess.overrideUser || 'Gaming Cashier',
          createdAt: sess.createdAt,
          isCancelled: sess.status === 'CANCELLED',
          cancellationReason: sess.notes?.includes('Cancelled') ? sess.notes : null,
          cancelledAt: sess.status === 'CANCELLED' ? sess.updatedAt : null,
          cancelledByName: sess.overrideUser || null,
          details: {
            sessionId: sess.id,
            sessionNumber: sess.sessionId,
            game: sess.game,
            pricing: sess.pricing,
            customer: sess.customer,
            duration: sess.duration,
            adultCount: sess.adultCount,
            childCount: sess.childCount,
            guestCount: sess.guestCount,
            entryTime: sess.entryTime,
            exitTime: sess.exitTime,
            notes: sess.notes,
            payments: pDetails,
            invoices: sess.invoices,
          },
        });
      }
    }

    // 4. Filter by Payment Method if provided
    let filteredBills = bills;
    if (paymentMethod && paymentMethod !== 'ALL') {
      filteredBills = filteredBills.filter(
        (b) => b.paymentMethod.toUpperCase() === paymentMethod.toUpperCase(),
      );
    }

    // 5. Search by Bill #, Customer Name, Phone, or Cashier
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      filteredBills = filteredBills.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(q) ||
          b.displayNumber.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.toLowerCase().includes(q) ||
          b.cashierOrOperator.toLowerCase().includes(q) ||
          b.itemsSummary.toLowerCase().includes(q),
      );
    }

    // Sort by createdAt descending
    filteredBills.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 6. Compute Aggregate Summary KPIs across the filtered period
    let totalRevenue = 0;
    let totalBillsCount = 0;
    let restaurantSales = 0;
    let restaurantCount = 0;
    let trampolineSales = 0;
    let trampolineCount = 0;
    let coinGamesSales = 0;
    let coinCount = 0;
    let cancelledCount = 0;
    let cancelledAmount = 0;

    const paymentTotals: Record<string, number> = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      MIXED: 0,
    };

    for (const b of filteredBills) {
      totalBillsCount++;
      if (b.isCancelled) {
        cancelledCount++;
        cancelledAmount += b.grandTotal;
      } else {
        totalRevenue += b.grandTotal;

        const pm = b.paymentMethod.toUpperCase();
        paymentTotals[pm] = (paymentTotals[pm] || 0) + b.grandTotal;

        if (b.billType === 'RESTAURANT') {
          restaurantSales += b.grandTotal;
          restaurantCount++;
        } else if (b.billType === 'TRAMPOLINE') {
          trampolineSales += b.grandTotal;
          trampolineCount++;
        } else if (b.billType === 'COIN_GAMES') {
          coinGamesSales += b.grandTotal;
          coinCount++;
        }
      }
    }

    return {
      bills: filteredBills,
      summary: {
        totalRevenue,
        totalBillsCount,
        restaurantSales,
        restaurantCount,
        trampolineSales,
        trampolineCount,
        coinGamesSales,
        coinCount,
        cancelledCount,
        cancelledAmount,
        paymentBreakdown: paymentTotals,
      },
      timeRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  }

  async getBillDetail(billType: 'RESTAURANT' | 'TRAMPOLINE' | 'COIN_GAMES', id: string) {
    if (billType === 'RESTAURANT') {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              dish: { include: { category: true } },
            },
          },
          table: true,
          cashier: { select: { id: true, name: true, email: true } },
          payments: true,
        },
      });
      if (!order) {
        throw new NotFoundException('Restaurant order not found');
      }
      return { billType, order };
    } else {
      const session = await this.prisma.gameSession.findUnique({
        where: { id },
        include: {
          customer: true,
          game: true,
          pricing: true,
          payments: true,
          invoices: true,
          activityLogs: true,
        },
      });
      if (!session) {
        throw new NotFoundException('Gaming session bill not found');
      }
      return { billType, session };
    }
  }

  async deleteBill(adminUser: any, billType: string, id: string, dto: DeleteBillDto) {
    const reason = dto.reason || 'Deleted by Administrator';
    const isHardDelete = dto.hardDelete !== false;

    if (billType === 'RESTAURANT') {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: { table: true, items: true, payments: true },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (isHardDelete) {
        await this.prisma.$transaction(async (tx) => {
          // 1. Delete associated payments
          await tx.payment.deleteMany({ where: { orderId: id } });
          // 2. Delete order items
          await tx.orderItem.deleteMany({ where: { orderId: id } });
          // 3. Delete order
          await tx.order.delete({ where: { id } });

          // 4. Restore table to AVAILABLE if Dine-In and no other active order
          if (order.tableId) {
            const activeOtherOrders = await tx.order.count({
              where: {
                tableId: order.tableId,
                id: { not: id },
                status: {
                  in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED],
                },
              },
            });
            if (activeOtherOrders === 0) {
              await tx.table.update({
                where: { id: order.tableId },
                data: { status: TableStatus.AVAILABLE },
              });
            }
          }
        });

        return {
          success: true,
          message: `Restaurant Bill #POS-${order.orderNumber} permanently deleted by Admin ${adminUser.name}`,
          billId: id,
          billType,
          action: 'HARD_DELETE',
        };
      } else {
        // Soft delete / Void
        const cancelled = await this.prisma.$transaction(async (tx) => {
          const ord = await tx.order.update({
            where: { id },
            data: {
              status: OrderStatus.CANCELLED,
              cancellationReason: reason,
              cancelledAt: new Date(),
              cancelledByName: adminUser.name,
              deletedAt: new Date(),
            },
          });

          if (order.tableId) {
            await tx.table.update({
              where: { id: order.tableId },
              data: { status: TableStatus.AVAILABLE },
            });
          }
          return ord;
        });

        return {
          success: true,
          message: `Restaurant Bill #POS-${order.orderNumber} marked as void/cancelled by Admin ${adminUser.name}`,
          billId: id,
          billType,
          action: 'SOFT_DELETE',
          order: cancelled,
        };
      }
    } else if (billType === 'TRAMPOLINE' || billType === 'COIN_GAMES' || billType === 'GAMING') {
      const session = await this.prisma.gameSession.findUnique({
        where: { id },
        include: { customer: true, payments: true, invoices: true },
      });
      if (!session) {
        throw new NotFoundException(`Gaming session with ID ${id} not found`);
      }

      if (isHardDelete) {
        await this.prisma.$transaction(async (tx) => {
          // 1. Delete associated payments
          await tx.gamePayment.deleteMany({ where: { sessionId: id } });
          // 2. Delete associated invoices
          await tx.gameInvoice.deleteMany({ where: { sessionId: id } });
          // 3. Delete activity logs
          await tx.gameActivityLog.deleteMany({ where: { sessionId: id } });
          // 4. Delete session
          await tx.gameSession.delete({ where: { id } });
        });

        return {
          success: true,
          message: `Gaming Bill #${session.sessionId} (${billType}) permanently deleted by Admin ${adminUser.name}`,
          billId: id,
          billType,
          action: 'HARD_DELETE',
        };
      } else {
        const updated = await this.prisma.gameSession.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            notes: (session.notes ? session.notes + ' | ' : '') + `Cancelled by Admin ${adminUser.name}: ${reason}`,
            overrideUser: adminUser.name,
            overrideReason: reason,
          },
        });

        return {
          success: true,
          message: `Gaming Bill #${session.sessionId} marked as cancelled by Admin ${adminUser.name}`,
          billId: id,
          billType,
          action: 'SOFT_DELETE',
          session: updated,
        };
      }
    } else {
      throw new BadRequestException(`Unknown bill type: ${billType}`);
    }
  }
}
