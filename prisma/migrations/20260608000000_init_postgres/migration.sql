-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "telegramUsername" TEXT,
    "photoUrl" TEXT,
    "city" TEXT,
    "level" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "levelAssessmentScore" INTEGER,
    "levelAssessmentDate" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "gamesCount" INTEGER NOT NULL DEFAULT 0,
    "cancellations" INTEGER NOT NULL DEFAULT 0,
    "noShows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "city" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "clubId" TEXT,
    "address" TEXT NOT NULL,
    "courtNumber" TEXT NOT NULL,
    "courtPricePerHour" DECIMAL(65,30) NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "pricePerPlayer" DECIMAL(65,30) NOT NULL,
    "minLevel" DOUBLE PRECISION NOT NULL,
    "maxLevel" DOUBLE PRECISION NOT NULL,
    "organizerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'JOINED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "noShowMarkedAt" TIMESTAMP(3),
    "noShowMarkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "hourlyCourtPrice" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Game_clubId_idx" ON "Game"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_userId_gameId_key" ON "Participation"("userId", "gameId");

-- CreateIndex
CREATE INDEX "Participation_gameId_status_createdAt_idx" ON "Participation"("gameId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Club_city_idx" ON "Club"("city");

-- CreateIndex
CREATE INDEX "Club_deletedAt_idx" ON "Club"("deletedAt");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
