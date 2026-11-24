import { prisma } from "@/lib/prisma";
import { TournamentParticipantStatus, TournamentStatus } from "@/lib/statuses";
import { getTournamentRanking, tournamentPoints, winRate, type RankingPlayer } from "@/lib/tournaments";
import { HIDDEN_USER_FILTER } from "@/lib/users";
import { effectiveRating, ratingToBand } from "@/lib/levels";

export type RatingEntry = {
  userId: string;
  name: string;
  lastName: string;
  photoUrl: string | null;
  city: string | null;
  rating: number;
  band: string;
  matchesPlayed: number;
  place: number | null;
  movement: number | null;
};

/**
 * Live leaderboard sorted by game rating (skillRating, seeded from the survey).
 * Players who have a rating (assessment done OR a ranked match) are "ranked";
 * the rest are listed separately. Weekly movement reuses the snapshot table.
 */
export async function getRatingRanking(): Promise<{ ranked: RatingEntry[]; unranked: RatingEntry[] }> {
  const [users, previousPlaces] = await Promise.all([
    prisma.user.findMany({ where: { deactivatedAt: null, ...HIDDEN_USER_FILTER } }),
    getPreviousPlaces()
  ]);

  type U = { id: string; name: string; lastName: string; photoUrl: string | null; city: string | null; level: number; skillRating: number | null; ratedGames: number | null; levelAssessmentDate: Date | null };
  const rows = (users as unknown as U[]).map((u) => ({
    userId: u.id,
    name: u.name,
    lastName: u.lastName,
    photoUrl: u.photoUrl,
    city: u.city,
    rating: Math.round(effectiveRating(u) * 100) / 100,
    matchesPlayed: u.ratedGames ?? 0,
    hasRating: u.skillRating != null || u.levelAssessmentDate != null
  }));

  const sorted = rows
    .filter((r) => r.hasRating)
    .sort((a, b) => b.rating - a.rating || b.matchesPlayed - a.matchesPlayed || `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "ru"));

  let lastRating: number | null = null;
  let lastPlace = 0;
  const ranked: RatingEntry[] = sorted.map((r, index) => {
    const place = r.rating === lastRating ? lastPlace : index + 1;
    lastRating = r.rating;
    lastPlace = place;
    const previous = previousPlaces.get(r.userId);
    return { ...r, band: ratingToBand(r.rating), place, movement: previous != null ? previous - place : null };
  });

  const unranked: RatingEntry[] = rows
    .filter((r) => !r.hasRating)
    .map((r) => ({ ...r, band: ratingToBand(r.rating), place: null, movement: null }))
    .sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "ru"));

  return { ranked, unranked };
}

/**
 * Ranking layer on top of lib/tournaments:
 *  - getFullRanking: every active player (ranked + not-yet-ranked) with weekly movement
 *  - getPlayerRankingDetail: 2026 + career stats for the detail page
 *  - captureRankingSnapshot: weekly snapshot powering "best rank" and the +/- arrow
 *
 * Snapshots are written by /api/cron/snapshot (weekly Vercel cron). Movement is the
 * change vs the most recent snapshot at least ~6 days old (i.e. last week's table).
 */

export type RankedEntry = RankingPlayer & {
  place: number | null;
  city: string | null;
  movement: number | null; // previousPlace - currentPlace; >0 = moved up; null = no prior data
};

export type FullRanking = {
  ranked: RankedEntry[];
  unranked: RankedEntry[];
};

// The Prisma client in this sandbox predates RankingSnapshot; cast is resolved by
// `prisma generate` on a machine with network access.
function snapshotModel() {
  return (prisma as unknown as { rankingSnapshot: any }).rankingSnapshot;
}

async function getPreviousPlaces(): Promise<Map<string, number>> {
  const model = snapshotModel();
  const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const latest = await model.findFirst({
    where: { takenAt: { lte: cutoff } },
    orderBy: { takenAt: "desc" },
    select: { takenAt: true }
  });
  if (!latest) return new Map();
  const rows = await model.findMany({
    where: { takenAt: latest.takenAt },
    select: { userId: true, place: true }
  });
  return new Map(rows.map((row: { userId: string; place: number }) => [row.userId, row.place]));
}

export async function getFullRanking(opts?: { year?: number }): Promise<FullRanking> {
  const [ranking, users, previousPlaces] = await Promise.all([
    getTournamentRanking(opts),
    prisma.user.findMany({
      where: { deactivatedAt: null, ...HIDDEN_USER_FILTER },
      select: { id: true, name: true, lastName: true, photoUrl: true, city: true }
    }),
    // The weekly +/- arrow is derived from all-time snapshots, so it only applies
    // to the all-time view. For a season view movement stays neutral.
    opts?.year ? Promise.resolve(new Map<string, number>()) : getPreviousPlaces()
  ]);

  const usersById = new Map(users.map((user) => [user.id, user]));
  const rankedIds = new Set(ranking.map((player) => player.userId));

  // Standard competition ranking: equal points share a place (1, 1, 3, 3, 5 …).
  let lastPoints: number | null = null;
  let lastPlace = 0;
  const ranked: RankedEntry[] = ranking.map((player, index) => {
    const place = player.totalPoints === lastPoints ? lastPlace : index + 1;
    lastPoints = player.totalPoints;
    lastPlace = place;
    const previous = previousPlaces.get(player.userId);
    return {
      ...player,
      place,
      city: usersById.get(player.userId)?.city ?? null,
      movement: previous != null ? previous - place : null
    };
  });

  const unranked: RankedEntry[] = users
    .filter((user) => !rankedIds.has(user.id))
    .map((user) => ({
      userId: user.id,
      name: user.name,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      totalPoints: 0,
      tournamentsPlayed: 0,
      matchesPlayed: 0,
      wins: 0,
      winRate: 0,
      bestPlace: null,
      titles: 0,
      place: null,
      city: user.city,
      movement: null
    }))
    .sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "ru"));

  return { ranked, unranked };
}

type StatParticipation = {
  matchesPlayed: number;
  wins: number;
  place: number | null;
};

export type PlayerStats = {
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  tournamentsPlayed: number;
  titles: number;
  bestFinish: number | null;
  winRate: number;
};

function computeStats(parts: StatParticipation[]): PlayerStats {
  let points = 0;
  let matchesPlayed = 0;
  let wins = 0;
  let tournamentsPlayed = 0;
  let titles = 0;
  let bestFinish: number | null = null;

  for (const p of parts) {
    points += tournamentPoints(p.matchesPlayed, p.wins);
    matchesPlayed += p.matchesPlayed;
    wins += p.wins;
    if (p.matchesPlayed > 0) tournamentsPlayed += 1;
    if (p.place === 1) titles += 1;
    if (p.place != null) bestFinish = bestFinish == null ? p.place : Math.min(bestFinish, p.place);
  }

  return {
    points,
    matchesPlayed,
    wins,
    losses: matchesPlayed - wins,
    tournamentsPlayed,
    titles,
    bestFinish,
    winRate: winRate(matchesPlayed, wins)
  };
}

export type PlayerRankingDetail = {
  user: { id: string; name: string; lastName: string; photoUrl: string | null; city: string | null; level: number };
  place: number | null;
  movement: number | null;
  bestRank: number | null;
  totalPoints: number;
  career: PlayerStats;
  season: PlayerStats;
  seasonYear: number;
};

export async function getPlayerRankingDetail(userId: string): Promise<PlayerRankingDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, lastName: true, photoUrl: true, city: true, level: true }
  });
  if (!user) return null;

  const [{ ranked }, parts, snaps] = await Promise.all([
    getFullRanking(),
    prisma.tournamentParticipation.findMany({
      where: {
        userId,
        status: TournamentParticipantStatus.JOINED,
        tournament: { status: TournamentStatus.COMPLETED }
      },
      select: {
        matchesPlayed: true,
        wins: true,
        place: true,
        tournament: { select: { completedAt: true, startsAt: true } }
      }
    }),
    snapshotModel().findMany({ where: { userId }, select: { place: true } })
  ]);

  const entry = ranked.find((player) => player.userId === userId) ?? null;
  const place = entry?.place ?? null;
  const seasonYear = new Date().getFullYear();

  const career = computeStats(parts);
  const season = computeStats(
    parts.filter((p) => {
      const date = p.tournament.completedAt ?? p.tournament.startsAt;
      return date ? date.getFullYear() === seasonYear : false;
    })
  );

  const snapBest = snaps.length ? Math.min(...snaps.map((s: { place: number }) => s.place)) : null;
  const bestCandidates = [place, snapBest].filter((value): value is number => value != null);
  const bestRank = bestCandidates.length ? Math.min(...bestCandidates) : null;

  return {
    user,
    place,
    movement: entry?.movement ?? null,
    bestRank,
    totalPoints: career.points,
    career,
    season,
    seasonYear
  };
}

/** Capture the current rating leaderboard as a weekly snapshot (cron route).
 * Stores rating×100 in `points` so the schema is unchanged. */
export async function captureRankingSnapshot() {
  const { ranked } = await getRatingRanking();
  const rows = ranked.filter((r): r is RatingEntry & { place: number } => r.place != null);
  if (!rows.length) return { inserted: 0 };

  const takenAt = new Date();
  await snapshotModel().createMany({
    data: rows.map((r) => ({
      userId: r.userId,
      place: r.place,
      points: Math.round(r.rating * 100),
      takenAt
    }))
  });

  return { inserted: rows.length };
}
