/**
 * Doubles skill-rating engine (ELO-style) for ranked casual matches.
 *
 * This is a PURE module — no Prisma, no I/O — so it is trivially testable and
 * reusable. A "match" is a set of rounds; each round is a 2v2 game with a score.
 * Ratings live on the same 1–7 scale as the player `level`, so a player's first
 * ranked match seeds from their current level.
 *
 * Design decisions (see chat with Michael):
 *  - scoring "binary" (win = up / loss = down, default) avoids the counter-
 *    intuitive "I won 2 of 3 but dropped" cases that margin scoring produces and
 *    that demotivate casual players. "margin" is available for accuracy.
 *  - per-player K: provisional players (few rated games) move faster so an
 *    inaccurate seed converges quickly; established players move slowly.
 *  - the expected score uses the AVERAGE rating of each pair (standard for
 *    doubles), and beating a much weaker pair yields almost nothing — which is
 *    exactly why a high-rated player can't farm rating off weak opponents.
 */

export type RoundInput = {
  /** the two user ids on side A */
  teamA: [string, string];
  /** the two user ids on side B */
  teamB: [string, string];
  /** games won by side A (e.g. 6) */
  gamesA: number;
  /** games won by side B (e.g. 3) */
  gamesB: number;
};

export type RatingOptions = {
  /** rating-gap sensitivity; 1.0 gap → strong favorite at the default. */
  divisor?: number;
  /** step size for players past the provisional window. */
  kEstablished?: number;
  /** larger step while a player is still provisional (seed converges fast). */
  kProvisional?: number;
  /** number of rated games before a player is considered established. */
  provisionalGames?: number;
  /** "binary" = win/loss only (default); "margin" = weight by the score. */
  scoring?: "binary" | "margin";
  /** clamp final ratings to this floor. */
  minRating?: number;
  /** clamp final ratings to this cap. */
  maxRating?: number;
};

export type PlayerRatingChange = {
  userId: string;
  before: number;
  after: number;
  delta: number;
  /** rounds the player actually appeared in (for transparency). */
  rounds: number;
};

export type MatchRatingResult = {
  changes: Record<string, PlayerRatingChange>;
  /** per-round signed delta applied to side A (side B is the negative). */
  perRound: { teamADelta: number; expectedA: number; actualA: number }[];
};

const DEFAULTS: Required<RatingOptions> = {
  divisor: 1.0,
  kEstablished: 0.1,
  kProvisional: 0.15,
  provisionalGames: 8,
  scoring: "binary",
  minRating: 1.0,
  maxRating: 7.0
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Expected score for side A given the two pair-average ratings. */
function expectedScore(avgA: number, avgB: number, divisor: number) {
  return 1 / (1 + 10 ** ((avgB - avgA) / divisor));
}

/**
 * Compute rating changes for one ranked match.
 *
 * @param startRatings    current rating per user id (seed from `level` on first match)
 * @param ratedGamesPlayed how many rated games each user already has (for provisional K)
 * @param rounds          the 2v2 rounds with scores
 */
export function computeMatchRatings(
  startRatings: Record<string, number>,
  ratedGamesPlayed: Record<string, number>,
  rounds: RoundInput[],
  options?: RatingOptions
): MatchRatingResult {
  const opts = { ...DEFAULTS, ...options };
  const live: Record<string, number> = { ...startRatings };
  const roundCount: Record<string, number> = {};
  const perRound: MatchRatingResult["perRound"] = [];

  const kFor = (userId: string) =>
    (ratedGamesPlayed[userId] ?? 0) < opts.provisionalGames ? opts.kProvisional : opts.kEstablished;

  for (const round of rounds) {
    const total = round.gamesA + round.gamesB;
    if (total <= 0) continue; // ignore empty / un-played rounds

    const avgA = (live[round.teamA[0]] + live[round.teamA[1]]) / 2;
    const avgB = (live[round.teamB[0]] + live[round.teamB[1]]) / 2;
    const expectedA = expectedScore(avgA, avgB, opts.divisor);
    const actualA =
      opts.scoring === "margin" ? round.gamesA / total : round.gamesA > round.gamesB ? 1 : round.gamesA < round.gamesB ? 0 : 0.5;
    const surpriseA = actualA - expectedA; // >0 → side A over-performed

    // Each player moves by their OWN K * surprise (sign flips per side). This
    // lets a provisional newbie move faster than an established partner.
    for (const id of round.teamA) {
      live[id] = clamp(live[id] + kFor(id) * surpriseA, opts.minRating, opts.maxRating);
      roundCount[id] = (roundCount[id] ?? 0) + 1;
    }
    for (const id of round.teamB) {
      live[id] = clamp(live[id] - kFor(id) * surpriseA, opts.minRating, opts.maxRating);
      roundCount[id] = (roundCount[id] ?? 0) + 1;
    }

    perRound.push({ teamADelta: kFor(round.teamA[0]) * surpriseA, expectedA, actualA });
  }

  const changes: Record<string, PlayerRatingChange> = {};
  for (const userId of Object.keys(startRatings)) {
    const before = startRatings[userId];
    const after = live[userId];
    changes[userId] = {
      userId,
      before,
      after,
      delta: after - before,
      rounds: roundCount[userId] ?? 0
    };
  }

  return { changes, perRound };
}
