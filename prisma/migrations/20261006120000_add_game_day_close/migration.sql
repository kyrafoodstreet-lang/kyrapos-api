-- CreateTable
CREATE TABLE "GameDayClose" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dateStr" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" TEXT NOT NULL,
    "closedByName" TEXT NOT NULL,
    "totalRevenue" DECIMAL(10,2) NOT NULL,
    "cashSales" DECIMAL(10,2) NOT NULL,
    "upiSales" DECIMAL(10,2) NOT NULL,
    "cardSales" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "trampCash" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "trampUpi" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "coinCash" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "coinUpi" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "otherCash" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "otherUpi" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "actualCash" DECIMAL(10,2) NOT NULL,
    "actualUpi" DECIMAL(10,2) NOT NULL,
    "actualTrampCash" DECIMAL(10,2) DEFAULT 0.00,
    "actualTrampUpi" DECIMAL(10,2) DEFAULT 0.00,
    "actualCoinCash" DECIMAL(10,2) DEFAULT 0.00,
    "actualCoinUpi" DECIMAL(10,2) DEFAULT 0.00,
    "cashDifference" DECIMAL(10,2) NOT NULL,
    "upiDifference" DECIMAL(10,2) NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "activeSessions" INTEGER NOT NULL DEFAULT 0,
    "totalVisitors" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameDayClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameDayClose_dateStr_key" ON "GameDayClose"("dateStr");

-- CreateIndex
CREATE INDEX "GameDayClose_date_idx" ON "GameDayClose"("date");

-- CreateIndex
CREATE INDEX "GameDayClose_dateStr_idx" ON "GameDayClose"("dateStr");
