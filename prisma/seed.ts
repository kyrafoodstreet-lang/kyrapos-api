import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as any;

async function main() {
  // Seeding script for Kyra POS database
  console.log('Seeding database...');

  // 1. Clean existing records (optional, but good for resetting)
  await prisma.gameActivityLog.deleteMany({});
  await prisma.gameInvoice.deleteMany({});
  await prisma.gamePayment.deleteMany({});
  await prisma.gameSession.deleteMany({});
  await prisma.gameCustomer.deleteMany({});
  await prisma.gamePricing.deleteMany({});
  await prisma.game.deleteMany({});

  await prisma.partyHallInvoice.deleteMany({});
  await prisma.partyHallPayment.deleteMany({});
  await prisma.partyHallService.deleteMany({});
  await prisma.partyHallBooking.deleteMany({});
  await prisma.partyHallCustomer.deleteMany({});
  await prisma.partyHall.deleteMany({});

  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.dish.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.table.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create Users
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('adminpassword', saltRounds);
  const managerPasswordHash = await bcrypt.hash('managerpassword', saltRounds);
  const cashierPasswordHash = await bcrypt.hash('cashierpassword', saltRounds);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@kyra.com',
      passwordHash: adminPasswordHash,
      name: 'Kyra Admin',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@kyra.com',
      passwordHash: managerPasswordHash,
      name: 'Kyra Manager',
      role: Role.MANAGER,
      isActive: true,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@kyra.com',
      passwordHash: cashierPasswordHash,
      name: 'Kyra Cashier',
      role: Role.CASHIER,
      isActive: true,
    },
  });

  console.log('Users created:');
  console.log(`- Admin: admin@kyra.com / adminpassword`);
  console.log(`- Manager: manager@kyra.com / managerpassword`);
  console.log(`- Cashier: cashier@kyra.com / cashierpassword`);

  // 3. Create Banquet Halls
  await prisma.partyHall.create({
    data: {
      name: 'Grand Ballroom',
      capacity: 500,
      baseRent: 50000,
      description: 'Elegant hall for large weddings and corporate events.',
    },
  });

  await prisma.partyHall.create({
    data: {
      name: 'Royal Court',
      capacity: 200,
      baseRent: 25000,
      description: 'Premium hall for family gatherings, birthdays, and seminars.',
    },
  });

  console.log('Banquet Halls seeded.');

  // 4. Create Games and Pricings
  const trampoline = await prisma.game.create({
    data: {
      name: 'Trampoline Park',
      description: 'Trampoline adventure park with safety nets and foam pits.',
    },
  });
  await prisma.gamePricing.createMany({
    data: [
      { gameId: trampoline.id, name: '30 Minutes', duration: 30, price: 250 },
      { gameId: trampoline.id, name: '60 Minutes', duration: 60, price: 400 },
      { gameId: trampoline.id, name: '90 Minutes', duration: 90, price: 550 },
    ],
  });

  const vr = await prisma.game.create({
    data: {
      name: 'VR Games',
      description: 'Virtual Reality immersive gaming headsets and motion chairs.',
    },
  });
  await prisma.gamePricing.createMany({
    data: [
      { gameId: vr.id, name: '15 Minutes', duration: 15, price: 150 },
      { gameId: vr.id, name: '30 Minutes', duration: 30, price: 250 },
    ],
  });

  const coin = await prisma.game.create({
    data: {
      name: 'Coin Games',
      description: 'Arcade coin-op machine games, basketball shootouts, and claw machines.',
    },
  });
  await prisma.gamePricing.createMany({
    data: [
      { gameId: coin.id, name: '₹100 Package', duration: 0, price: 100 },
      { gameId: coin.id, name: '₹200 Package', duration: 0, price: 200 },
      { gameId: coin.id, name: '₹500 Package', duration: 0, price: 500 },
    ],
  });

  const softPlay = await prisma.game.create({
    data: {
      name: 'Soft Play Area',
      description: 'Indoor kids play area with slides, ball pool, and climbing structures.',
    },
  });
  await prisma.gamePricing.createMany({
    data: [
      { gameId: softPlay.id, name: '60 Minutes', duration: 60, price: 200 },
      { gameId: softPlay.id, name: 'Unlimited Package', duration: 0, price: 350 },
    ],
  });

  console.log('Games and Pricings seeded.');

  // 5. Create Restaurant Tables
  await prisma.table.createMany({
    data: [
      { number: 'T-01', capacity: 2 },
      { number: 'T-02', capacity: 4 },
      { number: 'T-03', capacity: 4 },
      { number: 'T-04', capacity: 6 },
      { number: 'T-05', capacity: 6 },
      { number: 'T-06', capacity: 8 },
      { number: 'T-07', capacity: 4 },
      { number: 'T-08', capacity: 2 },
    ],
  });
  console.log('Restaurant Tables seeded.');

  // 6. Create Menu Categories & Dishes
  const starters = await prisma.category.create({
    data: { name: 'Starters', description: 'Appetizers and quick bites' },
  });

  const mainCourse = await prisma.category.create({
    data: { name: 'Main Course', description: 'Curries, Biryanis and Rice' },
  });

  const breads = await prisma.category.create({
    data: { name: 'Indian Breads', description: 'Freshly baked tandoori breads' },
  });

  const beverages = await prisma.category.create({
    data: { name: 'Beverages', description: 'Cold drinks, juices and sodas' },
  });

  const desserts = await prisma.category.create({
    data: { name: 'Desserts', description: 'Sweets and ice creams' },
  });

  await prisma.dish.createMany({
    data: [
      // Starters
      { name: 'Paneer Tikka', price: 280, taxRate: 5.0, categoryId: starters.id, preparationTime: 15 },
      { name: 'Chicken 65', price: 310, taxRate: 5.0, categoryId: starters.id, preparationTime: 15 },
      { name: 'Crispy Corn', price: 220, taxRate: 5.0, categoryId: starters.id, preparationTime: 10 },

      // Main Course
      { name: 'Special Chicken Biryani', price: 340, taxRate: 5.0, categoryId: mainCourse.id, preparationTime: 20 },
      { name: 'Paneer Butter Masala', price: 290, taxRate: 5.0, categoryId: mainCourse.id, preparationTime: 15 },
      { name: 'Dal Makhani', price: 240, taxRate: 5.0, categoryId: mainCourse.id, preparationTime: 15 },
      { name: 'Mutton Rogan Josh', price: 420, taxRate: 5.0, categoryId: mainCourse.id, preparationTime: 25 },

      // Breads
      { name: 'Butter Naan', price: 60, taxRate: 5.0, categoryId: breads.id, preparationTime: 5 },
      { name: 'Garlic Naan', price: 75, taxRate: 5.0, categoryId: breads.id, preparationTime: 5 },
      { name: 'Tandoori Roti', price: 35, taxRate: 5.0, categoryId: breads.id, preparationTime: 5 },

      // Beverages
      { name: 'Fresh Lime Soda', price: 80, taxRate: 5.0, categoryId: beverages.id, preparationTime: 5 },
      { name: 'Mango Lassi', price: 110, taxRate: 5.0, categoryId: beverages.id, preparationTime: 5 },
      { name: 'Cold Coffee', price: 130, taxRate: 5.0, categoryId: beverages.id, preparationTime: 5 },

      // Desserts
      { name: 'Gulab Jamun (2 pcs)', price: 90, taxRate: 5.0, categoryId: desserts.id, preparationTime: 5 },
      { name: 'Sizzling Brownie with Ice Cream', price: 180, taxRate: 5.0, categoryId: desserts.id, preparationTime: 10 },
    ],
  });
  console.log('Categories and Dishes seeded.');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
