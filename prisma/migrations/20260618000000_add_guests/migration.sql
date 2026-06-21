-- Guest invitations attached to games.
CREATE TABLE IF NOT EXISTS "Guest" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Guest_gameId_idx" ON "Guest"("gameId");
CREATE INDEX IF NOT EXISTS "Guest_invitedById_idx" ON "Guest"("invitedById");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Guest_gameId_fkey'
    ) THEN
        ALTER TABLE "Guest" ADD CONSTRAINT "Guest_gameId_fkey"
            FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Guest_invitedById_fkey'
    ) THEN
        ALTER TABLE "Guest" ADD CONSTRAINT "Guest_invitedById_fkey"
            FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
