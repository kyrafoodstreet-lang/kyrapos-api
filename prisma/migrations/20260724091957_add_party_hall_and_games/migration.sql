-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledByName" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "actualUpi" DECIMAL(10,2),
ADD COLUMN     "upiDifference" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "PartyHall" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "baseRent" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHallCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "altMobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyHallCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHallBooking" (
    "id" TEXT NOT NULL,
    "bookingNumber" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "hallRent" DECIMAL(10,2) NOT NULL,
    "decorCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "foodCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "soundCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "generatorCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "cleaningCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "extraCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "gst" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "grandTotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyHallBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHallService" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PartyHallService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHallPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyHallPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHallInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" SERIAL NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyHallInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHallActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyHallActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePricing" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "sessionId" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "extraCharges" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "gst" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "grandTotal" DECIMAL(10,2) NOT NULL,
    "overrideUser" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePayment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyHall_name_key" ON "PartyHall"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PartyHallCustomer_mobile_key" ON "PartyHallCustomer"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "PartyHallBooking_bookingNumber_key" ON "PartyHallBooking"("bookingNumber");

-- CreateIndex
CREATE INDEX "PartyHallBooking_customerId_idx" ON "PartyHallBooking"("customerId");

-- CreateIndex
CREATE INDEX "PartyHallBooking_hallId_idx" ON "PartyHallBooking"("hallId");

-- CreateIndex
CREATE INDEX "PartyHallService_bookingId_idx" ON "PartyHallService"("bookingId");

-- CreateIndex
CREATE INDEX "PartyHallPayment_bookingId_idx" ON "PartyHallPayment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyHallInvoice_invoiceNumber_key" ON "PartyHallInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "PartyHallInvoice_bookingId_idx" ON "PartyHallInvoice"("bookingId");

-- CreateIndex
CREATE INDEX "PartyHallActivityLog_userId_idx" ON "PartyHallActivityLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_name_key" ON "Game"("name");

-- CreateIndex
CREATE INDEX "GamePricing_gameId_idx" ON "GamePricing"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameCustomer_mobile_key" ON "GameCustomer"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_sessionId_key" ON "GameSession"("sessionId");

-- CreateIndex
CREATE INDEX "GameSession_customerId_idx" ON "GameSession"("customerId");

-- CreateIndex
CREATE INDEX "GameSession_gameId_idx" ON "GameSession"("gameId");

-- CreateIndex
CREATE INDEX "GameSession_pricingId_idx" ON "GameSession"("pricingId");

-- CreateIndex
CREATE INDEX "GamePayment_sessionId_idx" ON "GamePayment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameInvoice_invoiceNumber_key" ON "GameInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "GameInvoice_sessionId_idx" ON "GameInvoice"("sessionId");

-- CreateIndex
CREATE INDEX "GameActivityLog_userId_idx" ON "GameActivityLog"("userId");

-- CreateIndex
CREATE INDEX "GameActivityLog_sessionId_idx" ON "GameActivityLog"("sessionId");

-- AddForeignKey
ALTER TABLE "PartyHallBooking" ADD CONSTRAINT "PartyHallBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "PartyHallCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyHallBooking" ADD CONSTRAINT "PartyHallBooking_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "PartyHall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyHallService" ADD CONSTRAINT "PartyHallService_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PartyHallBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyHallPayment" ADD CONSTRAINT "PartyHallPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PartyHallBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyHallInvoice" ADD CONSTRAINT "PartyHallInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PartyHallBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePricing" ADD CONSTRAINT "GamePricing_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "GameCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "GamePricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePayment" ADD CONSTRAINT "GamePayment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameInvoice" ADD CONSTRAINT "GameInvoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameActivityLog" ADD CONSTRAINT "GameActivityLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
