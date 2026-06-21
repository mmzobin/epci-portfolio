-- Americano tournament format: rounds, matches and per-tournament config.
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "courts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "pointsPerMatch" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "scheduleReady" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "TournamentRound" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentRound_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TournamentRound_tournamentId_idx" ON "TournamentRound"("tournamentId");

CREATE TABLE IF NOT EXISTS "TournamentMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "court" INTEGER NOT NULL DEFAULT 1,
    "team1aId" TEXT NOT NULL,
    "team1bId" TEXT NOT NULL,
    "team2aId" TEXT NOT NULL,
    "team2bId" TEXT NOT NULL,
    "team1Score" INTEGER,
    "team2Score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TournamentMatch_tournamentId_idx" ON "TournamentMatch"("tournamentId");
CREATE INDEX IF NOT EXISTS "TournamentMatch_roundId_idx" ON "TournamentMatch"("roundId");

ALTER TABLE "TournamentRound" ADD CONSTRAINT "TournamentRound_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_tournamentId_fkey"
    FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
