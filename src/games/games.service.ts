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
  CreateCoinSaleDto,
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
      include: {
        pricings: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
      },
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

  private async generateCustomerCode(tx?: any): Promise<string> {
    const client = tx || this.prisma;
    const count = await client.gameCustomer.count();
    const nextNum = count + 1;
    let code = `CUST-${String(nextNum).padStart(6, '0')}`;
    let exists = await client.gameCustomer.findUnique({ where: { customerCode: code } });
    let offset = 1;
    while (exists) {
      code = `CUST-${String(nextNum + offset).padStart(6, '0')}`;
      exists = await client.gameCustomer.findUnique({ where: { customerCode: code } });
      offset++;
    }
    return code;
  }

  async getCustomers() {
    const list = await this.prisma.gameCustomer.findMany({
      include: {
        sessions: {
          include: { payments: true, game: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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

        if (s.game && !gameCounts[s.gameId]) {
          gameCounts[s.gameId] = { name: s.game.name, count: 0 };
        }
        if (s.game) {
          gameCounts[s.gameId].count += 1;
        }
      });

      const sortedGames = Object.values(gameCounts).sort((a, b) => b.count - a.count);
      const favoriteGame = sortedGames.length > 0 ? sortedGames[0].name : 'General Play';

      return {
        id: c.id,
        customerCode: (c as any).customerCode || `CUST-${c.id.slice(0, 6).toUpperCase()}`,
        name: c.name,
        mobile: c.mobile,
        email: (c as any).email || null,
        parentName: (c as any).parentName || null,
        childName: (c as any).childName || null,
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
    const cleanMobile = mobile.trim();
    const c = await this.prisma.gameCustomer.findUnique({
      where: { mobile: cleanMobile },
      include: {
        sessions: {
          include: { payments: true },
          orderBy: { entryTime: 'desc' },
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
      customerCode: (c as any).customerCode || `CUST-${c.id.slice(0, 6).toUpperCase()}`,
      name: c.name,
      mobile: c.mobile,
      email: (c as any).email || null,
      parentName: (c as any).parentName || null,
      childName: (c as any).childName || null,
      age: c.age || 0,
      gender: c.gender || 'OTHER',
      previousVisits: c.sessions.length,
      lastVisit: c.sessions.length > 0 ? c.sessions[0].entryTime : null,
      totalSpent,
      currentActiveSession: active ? active.id : null,
    };
  }

  async createCustomer(dto: CreateCustomerDto) {
    const cleanMobile = dto.mobile.trim();
    const existing = await this.prisma.gameCustomer.findUnique({
      where: { mobile: cleanMobile },
    });
    if (existing) {
      throw new BadRequestException('Customer with this mobile number already exists');
    }
    const customerCode = await this.generateCustomerCode();
    return this.prisma.gameCustomer.create({
      data: {
        customerCode,
        name: dto.name.trim(),
        mobile: cleanMobile,
        email: dto.email?.trim() || null,
        parentName: dto.parentName?.trim() || null,
        childName: dto.childName?.trim() || null,
        age: dto.age ?? 0,
        gender: dto.gender ?? 'OTHER',
      } as any,
    });
  }



  async validateOffer(code: string, subtotal: number) {
    if (!code || typeof code !== 'string') {
      throw new BadRequestException('Offer code is required');
    }
    const cleanCode = code.trim().toUpperCase();

    // Configured promotional offers
    const offerRules: Record<string, { type: 'PERCENT' | 'FLAT'; value: number; minSubtotal: number; maxDiscount?: number; description: string }> = {
      'KYRA10': { type: 'PERCENT', value: 10, minSubtotal: 100, maxDiscount: 200, description: '10% Discount on booking' },
      'WELCOME10': { type: 'PERCENT', value: 10, minSubtotal: 100, maxDiscount: 200, description: '10% Welcome Discount' },
      'KYRA20': { type: 'PERCENT', value: 20, minSubtotal: 300, maxDiscount: 500, description: '20% Special Discount' },
      'VIP20': { type: 'PERCENT', value: 20, minSubtotal: 300, maxDiscount: 500, description: '20% VIP Club Discount' },
      'FLAT50': { type: 'FLAT', value: 50, minSubtotal: 200, description: 'Flat ₹50 Off' },
      'FLAT100': { type: 'FLAT', value: 100, minSubtotal: 400, description: 'Flat ₹100 Off' },
      'WEEKEND': { type: 'PERCENT', value: 15, minSubtotal: 200, maxDiscount: 300, description: '15% Weekend Special' },
      'SPECIAL50': { type: 'FLAT', value: 50, minSubtotal: 150, description: '₹50 Promotional Offer' },
    };

    const offer = offerRules[cleanCode];
    if (!offer) {
      throw new BadRequestException(`Offer code '${cleanCode}' is invalid or expired`);
    }

    if (subtotal < offer.minSubtotal) {
      throw new BadRequestException(`Offer code '${cleanCode}' requires a minimum booking amount of ₹${offer.minSubtotal}`);
    }

    let discount = 0;
    if (offer.type === 'PERCENT') {
      discount = Math.round((subtotal * offer.value) / 100);
      if (offer.maxDiscount && discount > offer.maxDiscount) {
        discount = offer.maxDiscount;
      }
    } else {
      discount = offer.value;
    }
    discount = Math.min(discount, subtotal);
    const finalAmount = Math.max(0, subtotal - discount);

    return {
      valid: true,
      code: cleanCode,
      discount,
      subtotal,
      finalAmount,
      description: offer.description,
    };
  }

  // ==========================================
  // 4. GAME SESSIONS
  // ==========================================

  async getActiveSessions() {
    const list = await this.prisma.gameSession.findMany({
      where: {
        status: 'ACTIVE',
        game: {
          name: { contains: 'Trampoline', mode: 'insensitive' },
        },
      },
      include: { customer: true, game: true, pricing: true },
      orderBy: { entryTime: 'asc' },
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
    // Resolve Trampoline Game
    let game = null;
    if (dto.gameId) {
      game = await this.prisma.game.findFirst({
        where: { id: dto.gameId, deletedAt: null },
      });
    }
    if (!game) {
      game = await this.prisma.game.findFirst({
        where: { name: { contains: 'Trampoline', mode: 'insensitive' }, deletedAt: null },
      });
    }
    if (!game) {
      game = await this.prisma.game.findFirst({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }
    if (!game) {
      throw new NotFoundException('Trampoline game catalog entry not found');
    }

    // Trampoline Pricing Business Rules:
    let adultCount = Number(dto.adultCount ?? 0);
    let childCount = Number(dto.childCount ?? 0);
    if (adultCount === 0 && childCount === 0) {
      adultCount = 1;
    }
    const totalGuests = Math.max(1, adultCount + childCount);
    const duration = [30, 60, 90, 120].includes(Number(dto.duration)) ? Number(dto.duration) : 30;
    const durationMultiplier = duration / 30;

    const adultRatePer30 = 200;
    const childRatePer30 = 100;
    const adultTotal = adultCount * adultRatePer30 * durationMultiplier;
    const childTotal = childCount * childRatePer30 * durationMultiplier;
    let subtotal = Math.round(adultTotal + childTotal);

    // Optional Grip Socks (₹70 per pair)
    const socksCount = Math.max(0, Number(dto.socksCount || 0));
    const socksPrice = Number(dto.socksPrice || 70);
    const socksAmount = socksCount * socksPrice;
    if (socksAmount > 0) {
      subtotal += socksAmount;
    }

    // Validate Offer Code if supplied
    let offerDiscount = 0;
    if (dto.offerCode && dto.offerCode.trim()) {
      const offerResult = await this.validateOffer(dto.offerCode, subtotal);
      offerDiscount = offerResult.discount;
    }

    // Validate Manual / Discretionary Discount & Manager Override
    const manualDiscount = Number(dto.manualDiscount || dto.discount || 0);
    let isOverridden = false;
    let overrideUserName: string | null = null;
    let overrideReason: string | null = null;

    if (manualDiscount > 0) {
      if (cashierRole === 'ADMIN' || cashierRole === 'MANAGER') {
        isOverridden = true;
        const selfUser = await this.prisma.user.findUnique({ where: { id: cashierId } });
        overrideUserName = selfUser?.name || 'Manager';
        overrideReason = dto.overrideAuth?.reason || 'Manager Discretionary Discount self-approved';
      } else {
        if (!dto.overrideAuth) {
          throw new BadRequestException('Manager override credentials are required for discretionary discounts');
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
        overrideReason = dto.overrideAuth.reason;
      }
    }

    // Server-Authoritative Totals (NO GST)
    const totalDiscount = Math.min(subtotal, offerDiscount + manualDiscount);
    const finalGrandTotal = Math.max(0, subtotal - totalDiscount);

    // Validate Payment Method and Split Amounts
    const method = dto.paymentMethod?.toUpperCase() || 'CASH';
    let cashPortion = 0;
    let upiPortion = 0;

    if (method === 'CASH') {
      cashPortion = finalGrandTotal;
      upiPortion = 0;
    } else if (method === 'UPI') {
      cashPortion = 0;
      upiPortion = finalGrandTotal;
    } else if (method === 'CASH_AND_UPI' || method === 'CASH_UPI' || method === 'MIXED') {
      cashPortion = Number(dto.cashAmount || 0);
      upiPortion = Number(dto.upiAmount || 0);
      if (cashPortion < 0 || upiPortion < 0) {
        throw new BadRequestException('Payment amounts cannot be negative');
      }
      const splitSum = Math.round((cashPortion + upiPortion) * 100) / 100;
      if (Math.abs(splitSum - finalGrandTotal) > 0.01) {
        throw new BadRequestException(
          `Payment mismatch: Cash (₹${cashPortion}) + UPI (₹${upiPortion}) = ₹${splitSum}, which does not match Final Total ₹${finalGrandTotal}`,
        );
      }
    } else {
      cashPortion = finalGrandTotal;
    }

    return this.prisma.$transaction(async (tx) => {
      // Resolve or Create Customer inside Transaction
      let customer = null;
      if (dto.customerId) {
        customer = await tx.gameCustomer.findUnique({
          where: { id: dto.customerId },
        });
      } else if (dto.customerMobile) {
        const cleanMobile = dto.customerMobile.trim();
        customer = await tx.gameCustomer.findUnique({
          where: { mobile: cleanMobile },
        });

        if (!customer) {
          if (!dto.customerName || !dto.customerName.trim()) {
            throw new BadRequestException('Customer name is required to register a new customer');
          }
          const customerCode = await this.generateCustomerCode(tx);
          customer = await tx.gameCustomer.create({
            data: {
              customerCode,
              name: dto.customerName.trim(),
              mobile: cleanMobile,
              email: dto.customerEmail?.trim() || null,
              parentName: dto.customerParentName?.trim() || null,
              childName: dto.customerChildName?.trim() || null,
              age: 0,
              gender: 'OTHER',
            } as any,
          });
        }
      }

      if (!customer) {
        throw new BadRequestException('Customer profile could not be resolved or created');
      }

      const session = await tx.gameSession.create({
        data: {
          customerId: customer.id,
          gameId: game.id,
          guestCount: totalGuests,
          adultCount,
          childCount,
          duration,
          offerCode: dto.offerCode || undefined,
          status: 'ACTIVE',
          entryTime: new Date(),
          originalPrice: subtotal,
          discount: totalDiscount,
          extraCharges: 0,
          gst: 0, // NO GST
          grandTotal: finalGrandTotal,
          overrideUser: overrideUserName || undefined,
          overrideReason: overrideReason || undefined,
          notes: socksCount > 0
            ? (dto.notes ? `${dto.notes} | Grip Socks: ${socksCount} pair${socksCount > 1 ? 's' : ''} (₹${socksAmount})` : `Grip Socks: ${socksCount} pair${socksCount > 1 ? 's' : ''} (₹${socksAmount})`)
            : (dto.notes || undefined),
        } as any,
        include: {
          customer: true,
          game: true,
        },
      });

      // Create Payment Ledger Records
      if (finalGrandTotal > 0) {
        if (method === 'CASH_AND_UPI' || method === 'CASH_UPI' || method === 'MIXED') {
          if (cashPortion > 0) {
            await tx.gamePayment.create({
              data: {
                sessionId: session.id,
                amount: cashPortion,
                method: 'CASH',
                notes: `Split payment: Cash portion of booking #${session.sessionId}`,
                date: new Date(),
              },
            });
          }
          if (upiPortion > 0) {
            await tx.gamePayment.create({
              data: {
                sessionId: session.id,
                amount: upiPortion,
                method: 'UPI',
                notes: `Split payment: UPI portion of booking #${session.sessionId}`,
                date: new Date(),
              },
            });
          }
        } else {
          await tx.gamePayment.create({
            data: {
              sessionId: session.id,
              amount: finalGrandTotal,
              method: method,
              notes: `Booking #${session.sessionId} payment received via ${method}`,
              date: new Date(),
            },
          });
        }
      }

      // Log Activity
      const custCodeDisplay = (customer as any).customerCode || customer.id;
      await tx.gameActivityLog.create({
        data: {
          userId: cashierId,
          sessionId: session.id,
          action: 'CREATE_SESSION',
          details: `Trampoline Session #${session.sessionId} created for ${customer.name} (${custCodeDisplay}). Adults: ${adultCount}, Children: ${childCount}, Duration: ${duration}m. Paid: ₹${finalGrandTotal} via ${method}.`,
        },
      });

      if (isOverridden) {
        await tx.gameActivityLog.create({
          data: {
            userId: cashierId,
            sessionId: session.id,
            action: 'PRICE_OVERRIDE',
            details: `Manual discount of ₹${manualDiscount} approved by ${overrideUserName}. Reason: ${overrideReason}`,
          },
        });
      }

      return session;
    });
  }

  async sellCoins(cashierId: string, cashierRole: string, dto: CreateCoinSaleDto) {
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('At least one coin package item must be selected');
    }

    const packagePriceMap: Record<string, { coins: number; price: number; name: string }> = {
      'coin-1': { coins: 1, price: 40, name: '1 Token' },
      'coin-4': { coins: 4, price: 150, name: '4 Tokens' },
      'coin-10': { coins: 10, price: 350, name: '10 Tokens' },
    };

    let calculatedTotal = 0;
    let totalTokens = 0;
    const itemSummaries: string[] = [];

    for (const item of dto.items) {
      const pkgInfo = packagePriceMap[item.package];
      if (!pkgInfo) {
        throw new BadRequestException(`Invalid coin package identifier: ${item.package}`);
      }
      const qty = Number(item.quantity) || 0;
      if (qty < 0) {
        throw new BadRequestException('Package quantities cannot be negative');
      }
      if (qty > 0) {
        calculatedTotal += pkgInfo.price * qty;
        totalTokens += pkgInfo.coins * qty;
        itemSummaries.push(`${pkgInfo.name} × ${qty}`);
      }
    }

    if (calculatedTotal <= 0 || totalTokens <= 0) {
      throw new BadRequestException('Please select at least 1 coin package with a valid quantity');
    }

    // Payment validation
    const method = dto.paymentMethod?.toUpperCase() || 'CASH';
    let cashPortion = 0;
    let upiPortion = 0;

    if (method === 'CASH') {
      cashPortion = calculatedTotal;
      upiPortion = 0;
    } else if (method === 'UPI') {
      cashPortion = 0;
      upiPortion = calculatedTotal;
    } else if (method === 'CASH_AND_UPI' || method === 'CASH_UPI' || method === 'MIXED') {
      cashPortion = Number(dto.cashAmount || 0);
      upiPortion = Number(dto.upiAmount || 0);
      if (cashPortion < 0 || upiPortion < 0) {
        throw new BadRequestException('Payment portions cannot be negative');
      }
      const splitSum = Math.round((cashPortion + upiPortion) * 100) / 100;
      if (Math.abs(splitSum - calculatedTotal) > 0.01) {
        throw new BadRequestException(
          `Payment mismatch: Cash (₹${cashPortion}) + UPI (₹${upiPortion}) = ₹${splitSum}, which does not match Total ₹${calculatedTotal}`,
        );
      }
    } else {
      cashPortion = calculatedTotal;
    }

    // Resolve Coin Game Game catalog record
    let coinGame = await this.prisma.game.findFirst({
      where: { name: { contains: 'Coin', mode: 'insensitive' }, deletedAt: null },
    });
    if (!coinGame) {
      coinGame = await this.prisma.game.findFirst({
        where: { deletedAt: null },
      });
    }
    if (!coinGame) {
      throw new NotFoundException('Coin game catalog entry not found');
    }

    // Atomic transaction for Coin Game Sale
    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve or create customer
      let customer = null;
      if (dto.customerId) {
        customer = await tx.gameCustomer.findUnique({
          where: { id: dto.customerId },
        });
      } else if (dto.customerMobile) {
        const cleanMobile = dto.customerMobile.trim();
        customer = await tx.gameCustomer.findUnique({
          where: { mobile: cleanMobile },
        });

        if (!customer && dto.customerName && dto.customerName.trim()) {
          const customerCode = await this.generateCustomerCode(tx);
          customer = await tx.gameCustomer.create({
            data: {
              customerCode,
              name: dto.customerName.trim(),
              mobile: cleanMobile,
              email: dto.customerEmail?.trim() || null,
              age: 0,
              gender: 'OTHER',
            } as any,
          });
        }
      }

      // If no customer provided, resolve or create default walk-in guest
      if (!customer) {
        customer = await tx.gameCustomer.findFirst({
          where: { mobile: '0000000000' },
        });
        if (!customer) {
          customer = await tx.gameCustomer.create({
            data: {
              customerCode: 'CUST-WALKIN',
              name: 'Walk-in Guest',
              mobile: '0000000000',
              age: 0,
              gender: 'OTHER',
            } as any,
          });
        }
      }

      // 2. Create Sale Record (Stored with status COMPLETED so NO active timer, NO active session tracking)
      const now = new Date();
      const session = await tx.gameSession.create({
        data: {
          customerId: customer.id,
          gameId: coinGame.id,
          guestCount: totalTokens,
          adultCount: 0,
          childCount: 0,
          duration: 0,
          status: 'COMPLETED',
          entryTime: now,
          exitTime: now,
          originalPrice: calculatedTotal,
          discount: 0,
          extraCharges: 0,
          gst: 0,
          grandTotal: calculatedTotal,
          notes: `Coin Sale: ${totalTokens} Tokens (${itemSummaries.join(', ')})`,
        } as any,
        include: {
          customer: true,
          game: true,
        },
      });

      // 3. Create Payment Ledger
      if (calculatedTotal > 0) {
        if (method === 'CASH_AND_UPI' || method === 'CASH_UPI' || method === 'MIXED') {
          if (cashPortion > 0) {
            await tx.gamePayment.create({
              data: {
                sessionId: session.id,
                amount: cashPortion,
                method: 'CASH',
                notes: `Coin Sale #${session.sessionId}: Cash portion (${totalTokens} tokens)`,
                date: now,
              },
            });
          }
          if (upiPortion > 0) {
            await tx.gamePayment.create({
              data: {
                sessionId: session.id,
                amount: upiPortion,
                method: 'UPI',
                notes: `Coin Sale #${session.sessionId}: UPI portion (${totalTokens} tokens)`,
                date: now,
              },
            });
          }
        } else {
          await tx.gamePayment.create({
            data: {
              sessionId: session.id,
              amount: calculatedTotal,
              method: method,
              notes: `Coin Sale #${session.sessionId}: Paid via ${method} (${totalTokens} tokens)`,
              date: now,
            },
          });
        }
      }

      // 4. Log Activity
      await tx.gameActivityLog.create({
        data: {
          userId: cashierId,
          sessionId: session.id,
          action: 'COIN_SALE',
          details: `Coin Sale #${session.sessionId} completed for ${customer.name}. ${totalTokens} tokens sold for ₹${calculatedTotal} via ${method}.`,
        },
      });

      return {
        success: true,
        saleId: session.sessionId,
        id: session.id,
        totalTokens,
        grandTotal: calculatedTotal,
        totalAmount: calculatedTotal,
        paymentMethod: method,
        customer,
        items: dto.items,
      };
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
      throw new BadRequestException('Session is already closed or completed');
    }

    const exitTime = new Date();
    const entryTime = new Date(session.entryTime);
    
    // Calculate actual elapsed minutes
    const actualDuration = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 1000 / 60));

    // Overtime is for visual and operational monitoring only — no automatic surcharge is added to the bill
    const extraCharges = dto.extraCharges !== undefined ? Number(dto.extraCharges) : 0;
    const additionalDiscount = Number(dto.discount || 0);

    const prevPaymentsSum = session.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const subtotal = Number(session.originalPrice) - Number(session.discount) - additionalDiscount + extraCharges;
    const gstRate = 0; // Zero GST
    const grandTotal = Math.max(0, subtotal);
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
        packageName: (s as any).pricing?.name || `${(s as any).duration || 30}m Play`,
        entryTime: s.entryTime,
        status: s.status,
        grandTotal: Number(s.grandTotal),
      })),
    };
  }

  // ==========================================
  // 8. DAY CLOSING & RECONCILIATION
  // ==========================================

  private parseDateRange(dateStr?: string) {
    let targetDate: Date;
    let formattedDateStr: string;

    if (dateStr && dateStr.trim()) {
      formattedDateStr = dateStr.trim();
      const parts = formattedDateStr.split('-');
      if (parts.length === 3) {
        targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        targetDate = new Date(dateStr);
      }
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      formattedDateStr = `${yyyy}-${mm}-${dd}`;
      targetDate = new Date(yyyy, now.getMonth(), now.getDate());
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay, dateStr: formattedDateStr };
  }

  async getDayCloseStatus(dateStr?: string) {
    const { startOfDay, endOfDay, dateStr: formattedDateStr } = this.parseDateRange(dateStr);

    // 1. Fetch payments on this day
    const payments = await this.prisma.gamePayment.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        session: {
          include: {
            customer: true,
            game: true,
            pricing: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    let totalRevenue = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let mixedSales = 0;

    let trampCash = 0;
    let trampUpi = 0;
    let trampCard = 0;

    let coinCash = 0;
    let coinUpi = 0;
    let coinCard = 0;

    let otherCash = 0;
    let otherUpi = 0;
    let otherCard = 0;

    // Map for game specific payment collections
    const gamePaymentMap: Record<string, { cash: number; upi: number; card: number; total: number }> = {};

    for (const p of payments) {
      const amt = Number(p.amount);
      totalRevenue += amt;
      const m = (p.method || '').toUpperCase();
      const gNameRaw = p.session?.game?.name || 'General Arcade';
      const gNameLower = gNameRaw.toLowerCase();

      if (!gamePaymentMap[gNameRaw]) {
        gamePaymentMap[gNameRaw] = { cash: 0, upi: 0, card: 0, total: 0 };
      }
      gamePaymentMap[gNameRaw].total += amt;

      let pCash = 0;
      let pUpi = 0;
      let pCard = 0;

      if (m === 'CASH') {
        pCash = amt;
      } else if (m === 'UPI' || m === 'BANK_TRANSFER') {
        pUpi = amt;
      } else if (m === 'CARD') {
        pCard = amt;
      } else if (m === 'MIXED' || m.includes('CASH_AND_UPI')) {
        mixedSales += amt;
        if (p.notes && p.notes.includes('Cash:') && p.notes.includes('UPI:')) {
          const matchCash = p.notes.match(/Cash:\s*₹?([0-9.]+)/i);
          const matchUpi = p.notes.match(/UPI:\s*₹?([0-9.]+)/i);
          if (matchCash && matchUpi) {
            pCash = Number(matchCash[1]);
            pUpi = Number(matchUpi[1]);
          } else {
            pCash = amt / 2;
            pUpi = amt / 2;
          }
        } else {
          pCash = amt / 2;
          pUpi = amt / 2;
        }
      } else {
        pCash = amt;
      }

      cashSales += pCash;
      upiSales += pUpi;
      cardSales += pCard;

      gamePaymentMap[gNameRaw].cash += pCash;
      gamePaymentMap[gNameRaw].upi += pUpi;
      gamePaymentMap[gNameRaw].card += pCard;

      if (gNameLower.includes('tramp')) {
        trampCash += pCash;
        trampUpi += pUpi;
        trampCard += pCard;
      } else if (gNameLower.includes('coin') || gNameLower.includes('arcade')) {
        coinCash += pCash;
        coinUpi += pUpi;
        coinCard += pCard;
      } else {
        otherCash += pCash;
        otherUpi += pUpi;
        otherCard += pCard;
      }
    }

    // 2. Fetch sessions entered on this day
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        entryTime: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        customer: true,
        game: true,
        pricing: true,
        payments: true,
      },
      orderBy: { entryTime: 'asc' },
    });

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED').length;
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
    const totalVisitors = sessions.reduce((sum, s) => sum + (s.adultCount + s.childCount || s.guestCount || 1), 0);

    // 3. Category/Game Breakdown
    const gameBreakdownMap: Record<string, { name: string; sessions: number; visitors: number; revenue: number; cash: number; upi: number; card: number }> = {};
    for (const s of sessions) {
      const gName = s.game?.name || 'General Arcade';
      if (!gameBreakdownMap[gName]) {
        const pm = gamePaymentMap[gName] || { cash: 0, upi: 0, card: 0, total: 0 };
        gameBreakdownMap[gName] = {
          name: gName,
          sessions: 0,
          visitors: 0,
          revenue: 0,
          cash: Math.round(pm.cash * 100) / 100,
          upi: Math.round(pm.upi * 100) / 100,
          card: Math.round(pm.card * 100) / 100,
        };
      }
      gameBreakdownMap[gName].sessions += 1;
      gameBreakdownMap[gName].visitors += (s.adultCount + s.childCount || s.guestCount || 1);
      gameBreakdownMap[gName].revenue += Number(s.grandTotal);
    }

    // Ensure games with payments but no created sessions on same date are also included
    for (const [gName, pm] of Object.entries(gamePaymentMap)) {
      if (!gameBreakdownMap[gName]) {
        gameBreakdownMap[gName] = {
          name: gName,
          sessions: 0,
          visitors: 0,
          revenue: pm.total,
          cash: Math.round(pm.cash * 100) / 100,
          upi: Math.round(pm.upi * 100) / 100,
          card: Math.round(pm.card * 100) / 100,
        };
      }
    }

    const byGame = Object.values(gameBreakdownMap);

    // 4. Check if Day is already closed
    const closingRecord = await (this.prisma as any).gameDayClose.findUnique({
      where: { dateStr: formattedDateStr },
    });

    return {
      date: formattedDateStr,
      displayDate: startOfDay.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      isClosed: !!closingRecord,
      closingRecord: closingRecord
        ? {
            ...closingRecord,
            totalRevenue: Number(closingRecord.totalRevenue),
            cashSales: Number(closingRecord.cashSales),
            upiSales: Number(closingRecord.upiSales),
            cardSales: Number(closingRecord.cardSales),
            trampCash: Number(closingRecord.trampCash || 0),
            trampUpi: Number(closingRecord.trampUpi || 0),
            coinCash: Number(closingRecord.coinCash || 0),
            coinUpi: Number(closingRecord.coinUpi || 0),
            otherCash: Number(closingRecord.otherCash || 0),
            otherUpi: Number(closingRecord.otherUpi || 0),
            actualCash: Number(closingRecord.actualCash),
            actualUpi: Number(closingRecord.actualUpi),
            actualTrampCash: Number(closingRecord.actualTrampCash || 0),
            actualTrampUpi: Number(closingRecord.actualTrampUpi || 0),
            actualCoinCash: Number(closingRecord.actualCoinCash || 0),
            actualCoinUpi: Number(closingRecord.actualCoinUpi || 0),
            cashDifference: Number(closingRecord.cashDifference),
            upiDifference: Number(closingRecord.upiDifference),
          }
        : null,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        cashSales: Math.round(cashSales * 100) / 100,
        upiSales: Math.round(upiSales * 100) / 100,
        cardSales: Math.round(cardSales * 100) / 100,
        mixedSales: Math.round(mixedSales * 100) / 100,

        // Tramp & Coin Breakdown
        trampCash: Math.round(trampCash * 100) / 100,
        trampUpi: Math.round(trampUpi * 100) / 100,
        trampTotal: Math.round((trampCash + trampUpi + trampCard) * 100) / 100,

        coinCash: Math.round(coinCash * 100) / 100,
        coinUpi: Math.round(coinUpi * 100) / 100,
        coinTotal: Math.round((coinCash + coinUpi + coinCard) * 100) / 100,

        otherCash: Math.round(otherCash * 100) / 100,
        otherUpi: Math.round(otherUpi * 100) / 100,
        otherTotal: Math.round((otherCash + otherUpi + otherCard) * 100) / 100,

        totalSessions,
        completedSessions,
        activeSessions,
        totalVisitors,
        byGame,
      },
      transactions: payments.map((p) => ({
        id: p.id,
        sessionId: p.session?.sessionId || 0,
        gameName: p.session?.game?.name || 'Game',
        customerName: p.session?.customer?.name || 'Guest',
        customerMobile: p.session?.customer?.mobile || '',
        amount: Number(p.amount),
        method: p.method,
        notes: p.notes,
        time: p.date,
      })),
    };
  }

  async closeGameDay(
    user: { id: string; name?: string; email?: string },
    dto: {
      date?: string;
      actualCash?: number;
      actualUpi?: number;
      actualTrampCash?: number;
      actualTrampUpi?: number;
      actualCoinCash?: number;
      actualCoinUpi?: number;
      notes?: string;
    },
  ) {
    const statusData = await this.getDayCloseStatus(dto.date);
    const { startOfDay, dateStr: formattedDateStr } = this.parseDateRange(dto.date);

    const cashSales = statusData.summary.cashSales;
    const upiSales = statusData.summary.upiSales;
    const trampCash = statusData.summary.trampCash;
    const trampUpi = statusData.summary.trampUpi;
    const coinCash = statusData.summary.coinCash;
    const coinUpi = statusData.summary.coinUpi;
    const otherCash = statusData.summary.otherCash;
    const otherUpi = statusData.summary.otherUpi;

    const actualTrampCash = Number(dto.actualTrampCash ?? 0);
    const actualTrampUpi = Number(dto.actualTrampUpi ?? 0);
    const actualCoinCash = Number(dto.actualCoinCash ?? 0);
    const actualCoinUpi = Number(dto.actualCoinUpi ?? 0);

    // Calculate aggregated actual cash and UPI if not passed directly or calculate from sub-items
    let actualCash = dto.actualCash !== undefined ? Number(dto.actualCash) : 0;
    let actualUpi = dto.actualUpi !== undefined ? Number(dto.actualUpi) : 0;

    if (dto.actualCash === undefined && (dto.actualTrampCash !== undefined || dto.actualCoinCash !== undefined)) {
      actualCash = actualTrampCash + actualCoinCash;
    }
    if (dto.actualUpi === undefined && (dto.actualTrampUpi !== undefined || dto.actualCoinUpi !== undefined)) {
      actualUpi = actualTrampUpi + actualCoinUpi;
    }

    const cashDifference = Math.round((actualCash - cashSales) * 100) / 100;
    const upiDifference = Math.round((actualUpi - upiSales) * 100) / 100;

    const closedByName = user.name || user.email || 'Staff';

    // Upsert Day Close Record
    const dayCloseRecord = await (this.prisma as any).gameDayClose.upsert({
      where: { dateStr: formattedDateStr },
      update: {
        closedAt: new Date(),
        closedById: user.id,
        closedByName,
        totalRevenue: statusData.summary.totalRevenue,
        cashSales: cashSales,
        upiSales: upiSales,
        cardSales: statusData.summary.cardSales,
        trampCash: trampCash,
        trampUpi: trampUpi,
        coinCash: coinCash,
        coinUpi: coinUpi,
        otherCash: otherCash,
        otherUpi: otherUpi,
        actualCash,
        actualUpi,
        actualTrampCash,
        actualTrampUpi,
        actualCoinCash,
        actualCoinUpi,
        cashDifference,
        upiDifference,
        totalSessions: statusData.summary.totalSessions,
        completedSessions: statusData.summary.completedSessions,
        activeSessions: statusData.summary.activeSessions,
        totalVisitors: statusData.summary.totalVisitors,
        notes: dto.notes?.trim() || null,
      },
      create: {
        date: startOfDay,
        dateStr: formattedDateStr,
        closedAt: new Date(),
        closedById: user.id,
        closedByName,
        totalRevenue: statusData.summary.totalRevenue,
        cashSales: cashSales,
        upiSales: upiSales,
        cardSales: statusData.summary.cardSales,
        trampCash: trampCash,
        trampUpi: trampUpi,
        coinCash: coinCash,
        coinUpi: coinUpi,
        otherCash: otherCash,
        otherUpi: otherUpi,
        actualCash,
        actualUpi,
        actualTrampCash,
        actualTrampUpi,
        actualCoinCash,
        actualCoinUpi,
        cashDifference,
        upiDifference,
        totalSessions: statusData.summary.totalSessions,
        completedSessions: statusData.summary.completedSessions,
        activeSessions: statusData.summary.activeSessions,
        totalVisitors: statusData.summary.totalVisitors,
        notes: dto.notes?.trim() || null,
      },
    });

    // Log in GameActivityLog
    await this.prisma.gameActivityLog.create({
      data: {
        userId: user.id,
        action: 'GAME_DAY_CLOSE',
        details: `Closed Games day ${formattedDateStr}. Tramp Cash: ₹${trampCash} (Actual: ₹${actualTrampCash}), Tramp UPI: ₹${trampUpi} (Actual: ₹${actualTrampUpi}), Coin Cash: ₹${coinCash} (Actual: ₹${actualCoinCash}), Coin UPI: ₹${coinUpi} (Actual: ₹${actualCoinUpi}). Total Cash Diff: ₹${cashDifference}, Total UPI Diff: ₹${upiDifference}.`,
      },
    });

    return {
      success: true,
      message: `Games day for ${formattedDateStr} has been successfully closed!`,
      dayClose: {
        ...dayCloseRecord,
        totalRevenue: Number(dayCloseRecord.totalRevenue),
        cashSales: Number(dayCloseRecord.cashSales),
        upiSales: Number(dayCloseRecord.upiSales),
        cardSales: Number(dayCloseRecord.cardSales),
        trampCash: Number(dayCloseRecord.trampCash || 0),
        trampUpi: Number(dayCloseRecord.trampUpi || 0),
        coinCash: Number(dayCloseRecord.coinCash || 0),
        coinUpi: Number(dayCloseRecord.coinUpi || 0),
        otherCash: Number(dayCloseRecord.otherCash || 0),
        otherUpi: Number(dayCloseRecord.otherUpi || 0),
        actualCash: Number(dayCloseRecord.actualCash),
        actualUpi: Number(dayCloseRecord.actualUpi),
        actualTrampCash: Number(dayCloseRecord.actualTrampCash || 0),
        actualTrampUpi: Number(dayCloseRecord.actualTrampUpi || 0),
        actualCoinCash: Number(dayCloseRecord.actualCoinCash || 0),
        actualCoinUpi: Number(dayCloseRecord.actualCoinUpi || 0),
        cashDifference: Number(dayCloseRecord.cashDifference),
        upiDifference: Number(dayCloseRecord.upiDifference),
      },
      summary: statusData.summary,
    };
  }

  async getDayCloseHistory() {
    const list = await (this.prisma as any).gameDayClose.findMany({
      orderBy: { date: 'desc' },
      take: 60,
    });

    return list.map((item: any) => ({
      ...item,
      totalRevenue: Number(item.totalRevenue),
      cashSales: Number(item.cashSales),
      upiSales: Number(item.upiSales),
      cardSales: Number(item.cardSales),
      trampCash: Number(item.trampCash || 0),
      trampUpi: Number(item.trampUpi || 0),
      coinCash: Number(item.coinCash || 0),
      coinUpi: Number(item.coinUpi || 0),
      otherCash: Number(item.otherCash || 0),
      otherUpi: Number(item.otherUpi || 0),
      actualCash: Number(item.actualCash),
      actualUpi: Number(item.actualUpi),
      actualTrampCash: Number(item.actualTrampCash || 0),
      actualTrampUpi: Number(item.actualTrampUpi || 0),
      actualCoinCash: Number(item.actualCoinCash || 0),
      actualCoinUpi: Number(item.actualCoinUpi || 0),
      cashDifference: Number(item.cashDifference),
      upiDifference: Number(item.upiDifference),
    }));
  }

  // ==========================================
  // PUBLIC SELF-BOOKING & CUSTOMER LOOKUP
  // ==========================================

  async getPublicCatalog() {
    return this.prisma.game.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        pricings: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createPublicBooking(dto: {
    fullName: string;
    mobile: string;
    email?: string;
    gameId?: string;
    pricingId?: string;
    adultCount?: number;
    childCount?: number;
    notes?: string;
  }) {
    const mobileClean = (dto.mobile || '').replace(/\D/g, '').slice(-10);
    if (mobileClean.length < 10) {
      throw new BadRequestException('Please enter a valid 10-digit mobile number.');
    }

    let game: any = null;
    if (dto.gameId && dto.gameId.length > 10) {
      game = await this.prisma.game.findUnique({
        where: { id: dto.gameId },
      });
    }

    if (!game) {
      game = await this.prisma.game.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }

    if (!game) {
      game = await this.prisma.game.create({
        data: {
          name: 'Trampoline Park',
          description: 'Trampoline adventure park',
        },
      });
    }

    let pricing: any = null;
    let unitPrice = 0;
    let duration = 30;

    if (dto.pricingId) {
      pricing = await this.prisma.gamePricing.findUnique({
        where: { id: dto.pricingId },
      });
      if (pricing) {
        unitPrice = Number(pricing.price);
        duration = pricing.duration || 30;
      }
    }

    const adultCount = Math.max(0, Number(dto.adultCount || 0));
    const childCount = Math.max(0, Number(dto.childCount || 0));
    const totalGuests = Math.max(1, adultCount + childCount);

    // If unitPrice is 0, find first active pricing of the game
    if (unitPrice === 0) {
      const defaultPricing = await this.prisma.gamePricing.findFirst({
        where: { gameId: game.id, isActive: true },
        orderBy: { price: 'asc' },
      });
      if (defaultPricing) {
        pricing = defaultPricing;
        unitPrice = Number(defaultPricing.price);
        duration = defaultPricing.duration || 30;
      }
    }

    const totalAmount = pricing && pricing.duration === 0 ? unitPrice : unitPrice * totalGuests;

    // Upsert Customer by mobile
    let customer = await this.prisma.gameCustomer.findUnique({
      where: { mobile: mobileClean },
    });

    if (!customer) {
      customer = await this.prisma.gameCustomer.create({
        data: {
          name: dto.fullName.trim(),
          mobile: mobileClean,
          email: dto.email?.trim() || null,
        },
      });
    } else if (dto.fullName.trim()) {
      customer = await this.prisma.gameCustomer.update({
        where: { id: customer.id },
        data: {
          name: dto.fullName.trim(),
          email: dto.email?.trim() || customer.email,
        },
      });
    }

    // Generate unique booking code
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `BK-${randomSuffix}`;

    const booking = await (this.prisma as any).gameBooking.create({
      data: {
        bookingCode,
        customerId: customer.id,
        gameId: game.id,
        pricingId: pricing?.id || null,
        guestCount: totalGuests,
        adultCount,
        childCount,
        duration,
        unitPrice,
        totalAmount,
        status: 'CONFIRMED',
        notes: dto.notes?.trim() || null,
      },
      include: {
        customer: true,
        game: true,
        pricing: true,
      },
    });

    return {
      success: true,
      message: `Booking ${bookingCode} confirmed successfully!`,
      booking: {
        ...booking,
        unitPrice: Number(booking.unitPrice),
        totalAmount: Number(booking.totalAmount),
      },
    };
  }

  async lookupCustomerByMobile(mobile: string) {
    const mobileClean = (mobile || '').replace(/\D/g, '').slice(-10);
    if (!mobileClean) {
      return { customer: null, bookings: [], recentSessions: [] };
    }

    const customer = await this.prisma.gameCustomer.findFirst({
      where: {
        mobile: { contains: mobileClean },
      },
      include: {
        bookings: {
          where: { status: 'CONFIRMED' },
          include: { game: true, pricing: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        sessions: {
          include: { game: true, pricing: true, payments: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!customer) {
      return { customer: null, bookings: [], recentSessions: [] };
    }

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        email: customer.email,
      },
      bookings: customer.bookings.map((b: any) => ({
        ...b,
        unitPrice: Number(b.unitPrice),
        totalAmount: Number(b.totalAmount),
      })),
      recentSessions: customer.sessions.map((s: any) => ({
        ...s,
        grandTotal: Number(s.grandTotal),
      })),
    };
  }
}

