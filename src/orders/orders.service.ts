import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, CompletePaymentDto } from './dto/orders.dto';
import { OrdersGateway } from './orders.gateway';
import { OrderStatus, TableStatus, ShiftStatus, OrderType, PaymentStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private gateway: OrdersGateway,
  ) {}

  async create(cashierId: string, dto: CreateOrderDto) {
    // 1. Verify Active Shift
    const activeShift = await this.prisma.shift.findFirst({
      where: { cashierId, status: ShiftStatus.OPEN },
    });
    if (!activeShift) {
      throw new BadRequestException('You must open a shift before creating orders');
    }

    // 2. Table Validation for Dine-In: assign random or default table if none is provided
    let tableId = dto.tableId;
    if (dto.type === OrderType.DINE_IN && !tableId) {
      const availableTables = await this.prisma.table.findMany({
        where: { deletedAt: null },
      });
      if (availableTables.length > 0) {
        const randomTable = availableTables[Math.floor(Math.random() * availableTables.length)];
        tableId = randomTable.id;
      } else {
        const firstTable = await this.prisma.table.findFirst({
          where: { number: '1' }
        });
        if (firstTable) {
          tableId = firstTable.id;
        } else {
          const defaultTable = await this.prisma.table.create({
            data: {
              number: '1',
              capacity: 4,
              status: TableStatus.AVAILABLE,
            },
          });
          tableId = defaultTable.id;
        }
      }
    }

    let table = null;
    if (tableId) {
      table = await this.prisma.table.findFirst({
        where: { id: tableId, deletedAt: null },
      });
      if (!table) {
        throw new NotFoundException('Table not found');
      }
    }

    // 3. Compute Totals
    let subtotal = 0;
    let taxTotal = 0;
    const itemsData: any[] = [];

    for (const item of dto.items) {
      const dish = await this.prisma.dish.findFirst({
        where: { id: item.dishId, deletedAt: null },
      });
      if (!dish) {
        throw new NotFoundException(`Dish with ID ${item.dishId} not found`);
      }
      if (!dish.isAvailable) {
        throw new BadRequestException(`Dish "${dish.name}" is currently unavailable`);
      }

      const price = Number(dish.price);
      const taxRate = Number(dish.taxRate);
      const itemSubtotal = price * item.quantity;
      const itemTax = itemSubtotal * (taxRate / 100);

      subtotal += itemSubtotal;
      taxTotal += itemTax;

      itemsData.push({
        dishId: dish.id,
        quantity: item.quantity,
        price: price,
        taxRate: taxRate,
        notes: item.notes,
      });
    }

    const discountTotal = dto.discountTotal ?? 0;
    const grandTotal = Math.max(0, subtotal + taxTotal - discountTotal);

    // 4. Create Order inside Prisma Transaction
    const newOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tableId: tableId || null,
          cashierId,
          shiftId: activeShift.id,
          type: dto.type,
          subtotal,
          taxTotal,
          discountTotal,
          grandTotal,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          status: OrderStatus.PENDING,
          isHeld: false,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: {
            include: { dish: { include: { category: true } } },
          },
          table: true,
          cashier: { select: { id: true, name: true } },
        },
      });

      // Update Table Status if Dine-In
      if (dto.type === OrderType.DINE_IN && tableId) {
        await tx.table.update({
          where: { id: tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      return order;
    });

    // 5. Broadcast to websocket
    this.gateway.emitOrderCreated(newOrder);

    return newOrder;
  }

  async findAllActive() {
    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        isHeld: false,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED],
        },
      },
      include: {
        items: {
          include: { dish: true },
        },
        table: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' }, // Oldest orders first
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          include: { dish: true },
        },
        table: true,
        cashier: { select: { id: true, name: true } },
        payments: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async getHeldOrders() {
    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        isHeld: true,
      },
      include: {
        items: {
          include: { dish: true },
        },
        table: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async holdOrder(id: string) {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be put on hold');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { isHeld: true },
      include: {
        items: { include: { dish: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    this.gateway.emitOrderStatusUpdated(id, updated.status, updated);
    return updated;
  }

  async resumeOrder(id: string) {
    const order = await this.findOne(id);
    const updated = await this.prisma.order.update({
      where: { id },
      data: { isHeld: false },
      include: {
        items: { include: { dish: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    this.gateway.emitOrderStatusUpdated(id, updated.status, updated);
    return updated;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: {
        items: { include: { dish: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    this.gateway.emitOrderStatusUpdated(id, dto.status, updated);

    return updated;
  }

  async completePayment(orderId: string, dto: CompletePaymentDto) {
    const order = await this.findOne(orderId);
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Order is already fully paid and completed');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Log Payment
      await tx.payment.create({
        data: {
          orderId,
          amount: dto.amount,
          method: dto.method,
          status: PaymentStatus.COMPLETED,
          details: dto.details || null,
        },
      });

      // 2. Update Order to COMPLETED
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
        include: {
          items: { include: { dish: { include: { category: true } } } },
          table: true,
          cashier: { select: { id: true, name: true } },
        },
      });

      // 3. Update Table to CLEANING if Dine-In
      if (updated.type === OrderType.DINE_IN && updated.tableId) {
        await tx.table.update({
          where: { id: updated.tableId },
          data: { status: TableStatus.CLEANING },
        });
      }

      return updated;
    });

    this.gateway.emitOrderPaid(orderId, updatedOrder);
    return updatedOrder;
  }

  async searchCustomer(phone: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        customerPhone: phone,
        NOT: {
          customerName: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        customerName: true,
        customerPhone: true,
      },
    });

    if (!order) {
      return { found: false };
    }

    return { found: true, customerName: order.customerName, customerPhone: order.customerPhone };
  }

  async getCustomerSuggestions(prefix: string) {
    if (!prefix || prefix.length < 5) {
      return [];
    }

    const suggestions = await this.prisma.order.findMany({
      where: {
        customerPhone: {
          startsWith: prefix,
        },
        NOT: {
          customerName: null,
        },
      },
      distinct: ['customerPhone'],
      orderBy: {
        customerPhone: 'asc',
      },
      select: {
        customerName: true,
        customerPhone: true,
      },
      take: 5,
    });

    return suggestions;
  }

  async getSalesHistory(startDate?: string, endDate?: string) {
    const where: any = { deletedAt: null };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        cashier: { select: { name: true } },
        payments: true,
        items: {
          include: {
            dish: {
              include: { category: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalBills = 0;
    let totalSales = 0;
    let totalCancelledBills = 0;
    const categorySalesCount: Record<string, number> = {};

    const formattedOrders = orders.map((o) => {
      totalBills++;
      if (o.status === OrderStatus.COMPLETED) {
        totalSales += Number(o.grandTotal);
      } else if (o.status === OrderStatus.CANCELLED) {
        totalCancelledBills++;
      }

      if (o.status === OrderStatus.COMPLETED) {
        o.items.forEach((item) => {
          const catName = item.dish.category.name;
          categorySalesCount[catName] = (categorySalesCount[catName] || 0) + item.quantity;
        });
      }

      let paymentMethod = '-';
      if (o.payments && o.payments.length > 0) {
        paymentMethod = o.payments[0].method;
        if (o.payments.length > 1) {
          paymentMethod = 'MIXED';
        }
      }

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName || 'Walk-in Customer',
        customerPhone: o.customerPhone || '',
        createdAt: o.createdAt,
        status: o.status,
        paymentMethod,
        grandTotal: Number(o.grandTotal),
        cashierName: o.cashier?.name || 'Unknown',
        cancellationReason: o.cancellationReason,
        cancelledAt: o.cancelledAt,
        cancelledByName: o.cancelledByName,
      };
    });

    return {
      orders: formattedOrders,
      summary: {
        totalBills,
        totalSales,
        totalCancelledBills,
        categorySalesCount,
      }
    };
  }

  async cancelOrder(id: string, cashierName: string, reason: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledByName: cashierName,
        },
        include: {
          items: { include: { dish: true } },
          table: true,
          cashier: { select: { id: true, name: true } },
        },
      });

      if (ord.type === OrderType.DINE_IN && ord.tableId) {
        await tx.table.update({
          where: { id: ord.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      return ord;
    });

    this.gateway.emitOrderStatusUpdated(id, OrderStatus.CANCELLED, updated);
    return updated;
  }
}
