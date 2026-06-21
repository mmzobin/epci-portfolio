-- Fixed-pairs tournaments store each participant's selected partner.
ALTER TABLE "TournamentParticipation" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
