import { prisma } from "@/lib/prisma";
import { computeMatchRatings, type MatchRatingResult, type RoundInput } from "@/lib/rating";
import { ratingToBand } from "@/lib/levels";
import { ParticipationStatus, UserRole } from "@/lib/statuses";

/**
 * Ranked-match logic: store rounds → all participants confirm → apply ELO once.
 *
 * The new Prisma models/fields (MatchRound, MatchConfirmation, RatingChange,
 * Game.ranked/ratingAppliedAt, User.skillRating/ratedGames) aren't in the sandbox
 * client yet; `prisma generate` on deploy resolves the `as any` casts below.
 */

type GameManager = { id: string; role: string };

export type RoundDraft = {
  aPlayer1: string;
  aPlayer2: string;
  bPlayer1: string;
  bPlayer2: string;
  scoreA: number;
  scoreB: number;
};

const ACTIVE: readonly string[] = [
  ParticipationStatus.JOINED,
  ParticipationStatus.PLAYED,
  ParticipationStatus.NO_SHOW
];

const px = prisma as unknown as {
  matchRound: any;
  matchConfirmation: any;
  ratingChange: any;
  game: any;
  user: any;
};

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function canManage(manager: GameManager, game: { organizerId: string }) {
  return manager.role === UserRole.ADMIN || game.organizerId === manager.id;
}

async function activeParticipantIds(gameId: string, client: { participation: any } = prisma as any): Promise<string[]> {
  const rows = await client.participation.findMany({
    where: { gameId, status: { in: ACTIVE as string[] } },
    select: { userId: true }
  });
  return rows.map((r: { userId: string }) => r.userId);
}

const MAX_ROUNDS = 30;
const MAX_SCORE = 99;

function validateRounds(rounds: RoundDraft[], participantIds: Set<string>) {
  if (participantIds.size < 4) throw new Error("Для рейтинговой игры нужно минимум 4 участника");
  if (!Array.isArray(rounds) || !rounds.length) throw new Error("Нужен хотя бы один раунд");
  if (rounds.length > MAX_ROUNDS) throw new Error(`Слишком много раундов (максимум ${MAX_ROUNDS})`);
  rounds.forEach((r, i) => {
    const n = i + 1;
    const ids = [r.aPlayer1, r.aPlayer2, r.bPlayer1, r.bPlayer2];
    // Every slot must be filled with a real string id.
    if (ids.some((id) => typeof id !== "string" || id.trim() === "")) {
      throw new Error(`Раунд ${n}: выберите всех четырёх игроков`);
    }
    // The same player can't appear twice — not within a team and not across the
    // two teams. Four distinct ids required.
    if (new Set(ids).size !== 4) {
      throw new Error(`Раунд ${n}: один игрок не может быть в двух командах — нужны четыре разных`);
    }
    // Each player must actually be a participant of this match.
    for (const id of ids) {
      if (!participantIds.has(id)) throw new Error(`Раунд ${n}: выбран игрок, который не участвует в матче`);
    }
    // Scores: non-negative integers within a sane bound.
    if (![r.scoreA, r.scoreB].every((s) => Number.isInteger(s) && s >= 0 && s <= MAX_SCORE)) {
      throw new Error(`Раунд ${n}: счёт должен быть целым числом от 0 до ${MAX_SCORE}`);
    }
    // A ranked round must have a winner (no ties, no 0:0).
    if (r.scoreA === r.scoreB) {
      throw new Error(`Раунд ${n}: должен быть победитель — счёт не может быть равным`);
    }
  });
}

/** Toggle the ranked flag (before the rating has been applied). */
export async function setGameRanked(gameId: string, ranked: boolean, manager: GameManager) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (!canManage(manager, game)) throw new Error("You can manage only your own games");
  if ((game as { ratingAppliedAt?: Date | null }).ratingAppliedAt) {
    throw new Error("Рейтинг уже применён — режим менять нельзя");
  }
  return px.game.update({ where: { id: gameId }, data: { ranked } });
}

/** Replace the rounds of a ranked game. Resets confirmations; the editor's own
 * confirmation is recorded implicitly (they entered the score). */
export async function saveMatchRounds(gameId: string, rounds: RoundDraft[], manager: GameManager) {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as { matchRound: any; matchConfirmation: any; participation: any };
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new Error("Game not found");
    if (!canManage(manager, game)) throw new Error("You can manage only your own games");
    const g = game as { ranked?: boolean; ratingAppliedAt?: Date | null };
    if (!g.ranked) throw new Error("Игра не помечена как рейтинговая");
    if (g.ratingAppliedAt) throw new Error("Рейтинг уже применён — результат менять нельзя");

    const participantIds = new Set(await activeParticipantIds(gameId, tx as any));
    validateRounds(rounds, participantIds);

    await txAny.matchRound.deleteMany({ where: { gameId } });
    await txAny.matchConfirmation.deleteMany({ where: { gameId } });
    await txAny.matchRound.createMany({
      data: rounds.map((r, idx) => ({
        gameId,
        idx,
        aPlayer1: r.aPlayer1,
        aPlayer2: r.aPlayer2,
        bPlayer1: r.bPlayer1,
        bPlayer2: r.bPlayer2,
        scoreA: r.scoreA,
        scoreB: r.scoreB
      }))
    });
    await txAny.matchConfirmation.create({ data: { gameId, userId: manager.id } });
    return { ok: true, rounds: rounds.length };
  });
}

/** A participant confirms the result. Applies rating once everyone has confirmed. */
export async function confirmMatchResult(gameId: string, userId: string) {
  const participantIds = await activeParticipantIds(gameId);
  if (!participantIds.includes(userId)) throw new Error("Подтверждать может только участник матча");
  await px.matchConfirmation.upsert({
    where: { gameId_userId: { gameId, userId } },
    update: {},
    create: { gameId, userId }
  });
  const applied = await maybeApplyRating(gameId);
  return { ok: true, applied };
}

async function roundPlayerIds(gameId: string): Promise<string[]> {
  const rounds = await px.matchRound.findMany({
    where: { gameId },
    select: { aPlayer1: true, aPlayer2: true, bPlayer1: true, bPlayer2: true }
  });
  const ids = new Set<string>();
  for (const r of rounds as { aPlayer1: string; aPlayer2: string; bPlayer1: string; bPlayer2: string }[]) {
    [r.aPlayer1, r.aPlayer2, r.bPlayer1, r.bPlayer2].forEach((id) => ids.add(id));
  }
  return [...ids];
}

async function maybeApplyRating(gameId: string): Promise<boolean> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  const g = game as { ranked?: boolean; ratingAppliedAt?: Date | null } | null;
  if (!g?.ranked || g.ratingAppliedAt) return false;
  // Only the players who actually appear in the rounds need to confirm — a roster
  // member who didn't play shouldn't be able to block applying the rating.
  const required = await roundPlayerIds(gameId);
  if (required.length < 4) return false;
  const confirms = await px.matchConfirmation.findMany({ where: { gameId }, select: { userId: true } });
  const confirmed = new Set(confirms.map((c: { userId: string }) => c.userId));
  if (!required.every((id) => confirmed.has(id))) return false;
  await applyRating(gameId);
  return true;
}

async function loadMatchInputs(
  client: { matchRound: any; user: any },
  gameId: string
): Promise<{ startRatings: Record<string, number>; played: Record<string, number>; rounds: RoundInput[] } | null> {
  const roundRows = await client.matchRound.findMany({ where: { gameId }, orderBy: { idx: "asc" } });
  if (!roundRows.length) return null;
  const playerIds = new Set<string>();
  for (const r of roundRows) {
    [r.aPlayer1, r.aPlayer2, r.bPlayer1, r.bPlayer2].forEach((id: string) => playerIds.add(id));
  }
  const users = await client.user.findMany({ where: { id: { in: [...playerIds] } } });
  const startRatings: Record<string, number> = {};
  const played: Record<string, number> = {};
  for (const u of users as { id: string; level: number; skillRating: number | null; ratedGames: number | null }[]) {
    startRatings[u.id] = u.skillRating ?? u.level; // seed from level on first ranked match
    played[u.id] = u.ratedGames ?? 0;
  }
  const rounds: RoundInput[] = roundRows.map((r: RoundDraft) => ({
    teamA: [r.aPlayer1, r.aPlayer2],
    teamB: [r.bPlayer1, r.bPlayer2],
    gamesA: r.scoreA,
    gamesB: r.scoreB
  }));
  return { startRatings, played, rounds };
}

/** Compute (without persisting) what the rating change would be — for the
 * "pending confirmation" preview in the UI. */
export async function previewMatchRatings(gameId: string): Promise<MatchRatingResult | null> {
  const inputs = await loadMatchInputs(px, gameId);
  if (!inputs) return null;
  return computeMatchRatings(inputs.startRatings, inputs.played, inputs.rounds, { scoring: "binary" });
}

/** Apply the ELO deltas: write history, update skillRating + ratedGames, stamp
 * the game. Idempotent — a second call after it's applied is a no-op. */
export async function applyRating(gameId: string) {
  return prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as { matchRound: any; ratingChange: any; user: any; game: any };
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new Error("Game not found");
    const g = game as { ranked?: boolean; ratingAppliedAt?: Date | null };
    if (!g.ranked) throw new Error("Игра не рейтинговая");
    if (g.ratingAppliedAt) return { ok: true, alreadyApplied: true };

    const inputs = await loadMatchInputs(txAny, gameId);
    if (!inputs) throw new Error("Нет раундов для расчёта");
    const result = computeMatchRatings(inputs.startRatings, inputs.played, inputs.rounds, { scoring: "binary" });

    for (const userId of Object.keys(result.changes)) {
      const c = result.changes[userId];
      await txAny.ratingChange.create({
        data: { gameId, userId, before: round3(c.before), after: round3(c.after), delta: round3(c.delta) }
      });
      await txAny.user.update({
        where: { id: userId },
        data: { skillRating: round3(c.after), ratedGames: (inputs.played[userId] ?? 0) + 1 }
      });
    }
    await txAny.game.update({ where: { id: gameId }, data: { ratingAppliedAt: new Date() } });
    return { ok: true, changes: result.changes };
  });
}

export type PlayerGameStats = {
  rating: number | null;
  band: string | null;
  bestRating: number | null;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  partners: number;
  history: number[];
  form: ("W" | "L")[];
};

/** Aggregate a player's ranked-game stats (rating, record, partners, trend). */
export async function getPlayerGameStats(userId: string): Promise<PlayerGameStats> {
  const userRow = (await prisma.user.findUnique({ where: { id: userId } })) as { skillRating?: number | null; level: number } | null;
  const rating = userRow ? userRow.skillRating ?? userRow.level : null;

  const changes = await px.ratingChange.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const history = (changes as { after: number }[]).map((c) => Math.round(c.after * 100) / 100);
  const bestRating = rating == null ? null : Math.max(rating, ...(history.length ? history : [rating]));

  const rounds = await px.matchRound.findMany({
    where: {
      AND: [
        { OR: [{ aPlayer1: userId }, { aPlayer2: userId }, { bPlayer1: userId }, { bPlayer2: userId }] },
        { game: { ratingAppliedAt: { not: null } } }
      ]
    },
    orderBy: { createdAt: "asc" }
  });

  let wins = 0;
  let losses = 0;
  const partners = new Set<string>();
  const games = new Set<string>();
  const form: ("W" | "L")[] = [];
  for (const r of rounds as { gameId: string; aPlayer1: string; aPlayer2: string; bPlayer1: string; bPlayer2: string; scoreA: number; scoreB: number }[]) {
    games.add(r.gameId);
    const onA = r.aPlayer1 === userId || r.aPlayer2 === userId;
    const won = onA ? r.scoreA > r.scoreB : r.scoreB > r.scoreA;
    if (won) wins += 1;
    else losses += 1;
    form.push(won ? "W" : "L");
    const partner = onA ? (r.aPlayer1 === userId ? r.aPlayer2 : r.aPlayer1) : r.bPlayer1 === userId ? r.bPlayer2 : r.bPlayer1;
    if (partner && partner !== userId) partners.add(partner);
  }
  const total = wins + losses;

  return {
    rating: rating == null ? null : Math.round(rating * 100) / 100,
    band: rating == null ? null : ratingToBand(rating),
    bestRating: bestRating == null ? null : Math.round(bestRating * 100) / 100,
    matches: games.size,
    wins,
    losses,
    winRate: total ? Math.round((wins / total) * 100) : 0,
    partners: partners.size,
    history,
    form: form.slice(-5)
  };
}

export type RatingHistoryRow = { gameId: string; title: string; date: Date; before: number; after: number; delta: number };

/** A player's rating history (oldest → newest) for the profile graph. */
export async function getRatingHistory(userId: string): Promise<RatingHistoryRow[]> {
  const rows = await px.ratingChange.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { game: { select: { title: true } } }
  });
  return rows.map((r: { gameId: string; createdAt: Date; before: number; after: number; delta: number; game: { title: string } | null }) => ({
    gameId: r.gameId,
    title: r.game?.title ?? "",
    date: r.createdAt,
    before: r.before,
    after: r.after,
    delta: r.delta
  }));
}

/** Reverse an applied rating: restore each player's `before`, decrement their
 * rated-games counter, delete the history rows and clear the stamp. Only safe
 * when this is each player's latest applied match (their current rating still
 * equals this match's `after`), so the rating chain stays consistent. */
async function reverseApplied(gameId: string) {
  await prisma.$transaction(async (tx) => {
    const txAny = tx as unknown as { ratingChange: any; user: any; game: any };
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new Error("Game not found");
    if (!(game as { ranked?: boolean }).ranked) throw new Error("Игра не рейтинговая");

    const changes = await txAny.ratingChange.findMany({ where: { gameId } });
    if (!changes.length) throw new Error("Рейтинг по этой игре ещё не применён");

    const users = await tx.user.findMany({ where: { id: { in: changes.map((c: { userId: string }) => c.userId) } } });
    const byId = new Map((users as unknown as { id: string; level: number; skillRating: number | null; ratedGames: number | null }[]).map((u) => [u.id, u]));

    for (const c of changes as { userId: string; before: number; after: number }[]) {
      const u = byId.get(c.userId);
      if (!u) throw new Error("Игрок не найден");
      const current = u.skillRating ?? u.level;
      if (Math.abs(current - c.after) > 0.001) {
        throw new Error("Пересчёт доступен только если это последний матч игроков (рейтинг менялся в других играх)");
      }
    }

    for (const c of changes as { userId: string; before: number }[]) {
      const u = byId.get(c.userId)!;
      await txAny.user.update({
        where: { id: c.userId },
        data: { skillRating: round3(c.before), ratedGames: Math.max(0, (u.ratedGames ?? 1) - 1) }
      });
    }
    await txAny.ratingChange.deleteMany({ where: { gameId } });
    await txAny.game.update({ where: { id: gameId }, data: { ratingAppliedAt: null } });
  });
}

/** Admin: reverse + re-apply with the current engine settings (same rounds). */
export async function recomputeMatch(gameId: string) {
  await reverseApplied(gameId);
  return applyRating(gameId);
}

/** Admin: edit/add rounds even after the rating was applied, then recompute.
 * Reverses any applied rating, replaces the rounds, and re-applies. */
export async function recomputeWithRounds(gameId: string, rounds: RoundDraft[], manager: GameManager) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (!canManage(manager, game)) throw new Error("You can manage only your own games");
  if (!(game as { ranked?: boolean }).ranked) throw new Error("Игра не рейтинговая");
  if ((game as { ratingAppliedAt?: Date | null }).ratingAppliedAt) {
    await reverseApplied(gameId);
  }
  await saveMatchRounds(gameId, rounds, manager);
  return applyRating(gameId);
}

/** Everything the match screen needs in one read. */
export async function getMatchState(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  const g = game as { ranked?: boolean; ratingAppliedAt?: Date | null } | null;
  const [rounds, confirmations, changes, participantIds] = await Promise.all([
    px.matchRound.findMany({ where: { gameId }, orderBy: { idx: "asc" } }),
    px.matchConfirmation.findMany({ where: { gameId }, select: { userId: true, confirmedAt: true } }),
    px.ratingChange.findMany({ where: { gameId } }),
    activeParticipantIds(gameId)
  ]);
  return {
    ranked: Boolean(g?.ranked),
    appliedAt: g?.ratingAppliedAt ?? null,
    participantIds,
    rounds,
    confirmations,
    changes
  };
}
