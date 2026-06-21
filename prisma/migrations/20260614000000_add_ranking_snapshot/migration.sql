-- Weekly ranking snapshots: power "best rank" and the weekly +/- movement arrow.
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RankingSnapshot_takenAt_idx" ON "RankingSnapshot"("takenAt");
CREATE INDEX "RankingSnapshot_userId_takenAt_idx" ON "RankingSnapshot"("userId", "takenAt");

ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
