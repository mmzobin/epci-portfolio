-- Track whether the court for a game has been booked in Lazuz.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "courtBooked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "bookedById" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "bookedAt" TIMESTAMP(3);
