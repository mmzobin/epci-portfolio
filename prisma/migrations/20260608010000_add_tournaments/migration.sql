-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "city" TEXT,
    "club" TEXT,
    "format" TEXT NOT NULL DEFAULT 'MINI',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentParticipation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'JOINED',
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "tournamentPoints" INTEGER NOT NULL DEFAULT 0,
    "place" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Tournament_createdById_idx" ON "Tournament"("createdById");

-- CreateIndex
CREATE INDEX "TournamentParticipation_userId_idx" ON "TournamentParticipation"("userId");

-- CreateIndex
CREATE INDEX "TournamentParticipation_tournamentId_status_idx" ON "TournamentParticipation"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipation_tournamentId_userId_key" ON "TournamentParticipation"("tournamentId", "userId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipation" ADD CONSTRAINT "TournamentParticipation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipation" ADD CONSTRAINT "TournamentParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
