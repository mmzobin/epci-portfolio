-- Ranked matches + skill rating (run once on production).
-- Idempotent: safe to re-run. Adds columns/tables only, never drops data.

-- 1) User: skill rating + rated-games counter (provisional K window)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "skillRating" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ratedGames" INTEGER NOT NULL DEFAULT 0;

-- 2) Game: ranked flag + when rating was applied
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "ranked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "ratingAppliedAt" TIMESTAMP(3);

-- 3) Rounds of a ranked match (2v2 lineups + score)
CREATE TABLE IF NOT EXISTS "MatchRound" (
  "id"        TEXT NOT NULL,
  "gameId"    TEXT NOT NULL,
  "idx"       INTEGER NOT NULL,
  "aPlayer1"  TEXT NOT NULL,
  "aPlayer2"  TEXT NOT NULL,
  "bPlayer1"  TEXT NOT NULL,
  "bPlayer2"  TEXT NOT NULL,
  "scoreA"    INTEGER NOT NULL,
  "scoreB"    INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchRound_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MatchRound_gameId_idx" ON "MatchRound"("gameId");

-- 4) Per-player confirmation of the result (rating applies only when all confirm)
CREATE TABLE IF NOT EXISTS "MatchConfirmation" (
  "id"          TEXT NOT NULL,
  "gameId"      TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchConfirmation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MatchConfirmation_gameId_userId_key" ON "MatchConfirmation"("gameId", "userId");
CREATE INDEX IF NOT EXISTS "MatchConfirmation_gameId_idx" ON "MatchConfirmation"("gameId");

-- 5) Rating history (powers per-match deltas + the profile graph)
CREATE TABLE IF NOT EXISTS "RatingChange" (
  "id"        TEXT NOT NULL,
  "gameId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "before"    DOUBLE PRECISION NOT NULL,
  "after"     DOUBLE PRECISION NOT NULL,
  "delta"     DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RatingChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RatingChange_userId_createdAt_idx" ON "RatingChange"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RatingChange_gameId_idx" ON "RatingChange"("gameId");

-- 6) Foreign keys (cascade on game/user delete). Guarded so re-runs don't error.
DO $$ BEGIN
  ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MatchConfirmation" ADD CONSTRAINT "MatchConfirmation_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MatchConfirmation" ADD CONSTRAINT "MatchConfirmation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RatingChange" ADD CONSTRAINT "RatingChange_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
