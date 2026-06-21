-- Ranked matches + skill rating.
-- Idempotent so it can also reconcile databases where the SQL was applied manually.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "skillRating" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ratedGames" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "ranked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "ratingAppliedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "MatchRound" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "aPlayer1" TEXT NOT NULL,
    "aPlayer2" TEXT NOT NULL,
    "bPlayer1" TEXT NOT NULL,
    "bPlayer2" TEXT NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchRound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchRound_gameId_idx" ON "MatchRound"("gameId");

CREATE TABLE IF NOT EXISTS "MatchConfirmation" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchConfirmation_gameId_userId_key" ON "MatchConfirmation"("gameId", "userId");
CREATE INDEX IF NOT EXISTS "MatchConfirmation_gameId_idx" ON "MatchConfirmation"("gameId");

CREATE TABLE IF NOT EXISTS "RatingChange" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "before" DOUBLE PRECISION NOT NULL,
    "after" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RatingChange_userId_createdAt_idx" ON "RatingChange"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RatingChange_gameId_idx" ON "RatingChange"("gameId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MatchRound_gameId_fkey'
    ) THEN
        ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_gameId_fkey"
            FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MatchConfirmation_gameId_fkey'
    ) THEN
        ALTER TABLE "MatchConfirmation" ADD CONSTRAINT "MatchConfirmation_gameId_fkey"
            FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MatchConfirmation_userId_fkey'
    ) THEN
        ALTER TABLE "MatchConfirmation" ADD CONSTRAINT "MatchConfirmation_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RatingChange_gameId_fkey'
    ) THEN
        ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_gameId_fkey"
            FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RatingChange_userId_fkey'
    ) THEN
        ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
