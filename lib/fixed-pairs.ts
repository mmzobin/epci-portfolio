/**
 * Fixed-pairs round-robin engine (pure, no DB).
 *
 * "Pares fijas": teams of two stay together for the whole tournament. Every
 * pair plays every other pair once (single round-robin via the circle method).
 * Result per match is win/loss; standings rank pairs by wins, breaking ties
 * with a head-to-head mini-league, exactly like the Americano engine but at the
 * pair level instead of the player level.
 *
 * Edge cases:
 *  - Needs at least 2 pairs (validateFixedPairs).
 *  - Odd number of pairs → one pair rests each round (rotating bye); the
 *    schedule has P rounds instead of P-1.
 *  - Only matches with both scores set count toward standings.
 */

export type FixedPair = { id: string; player1: string; player2: string };

export type PairEngineMatch = { pair1: string; pair2: string; court: number };
export type PairEngineRound = { number: number; matches: PairEngineMatch[]; resting: string | null };

const BYE = "__BYE__";

export function validateFixedPairs(pairs: FixedPair[]): string | null {
  if (pairs.length < 2) return "Для турнира по парам нужно минимум 2 пары";
  const seen = new Set<string>();
  for (const p of pairs) {
    if (p.player1 === p.player2) return "В паре должны быть два разных игрока";
    for (const id of [p.player1, p.player2]) {
      if (seen.has(id)) return "Игрок не может быть в двух парах";
      seen.add(id);
    }
  }
  return null;
}

/** Circle-method round-robin over the pair ids. */
function roundRobin(ids: string[]): string[][][] {
  const list = ids.length % 2 === 0 ? [...ids] : [...ids, BYE];
  const n = list.length;
  const fixed = list[0];
  let rest = list.slice(1);
  const rounds: string[][][] = [];

  for (let r = 0; r < n - 1; r += 1) {
    const order = [fixed, ...rest];
    const matches: string[][] = [];
    for (let i = 0; i < n / 2; i += 1) {
      matches.push([order[i], order[n - 1 - i]]);
    }
    rounds.push(matches);
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }
  return rounds;
}

export function generateFixedPairsRounds(pairs: FixedPair[], courts = 1): PairEngineRound[] {
  const error = validateFixedPairs(pairs);
  if (error) throw new Error(error);
  const courtCount = Math.max(1, courts);
  const ids = pairs.map((p) => p.id);

  return roundRobin(ids).map((roundMatches, index) => {
    const matches: PairEngineMatch[] = [];
    let resting: string | null = null;
    let court = 1;
    for (const [a, b] of roundMatches) {
      if (a === BYE) { resting = b; continue; }
      if (b === BYE) { resting = a; continue; }
      matches.push({ pair1: a, pair2: b, court });
      court = (court % courtCount) + 1;
    }
    return { number: index + 1, matches, resting };
  });
}

export type PairStandingMatch = {
  pair1Id: string;
  pair2Id: string;
  pair1Score: number | null;
  pair2Score: number | null;
};

export type PairStanding = { pairId: string; wins: number; matchesPlayed: number; place: number };

/** Rank pairs by wins, breaking ties with a head-to-head mini-league.
 * Pairs that stay perfectly level share the same place (1, 1, 3 …). */
export function computePairStandings(pairIds: string[], matches: PairStandingMatch[]): PairStanding[] {
  const stats = new Map<string, PairStanding>(pairIds.map((id) => [id, { pairId: id, wins: 0, matchesPlayed: 0, place: 0 }]));
  const h2h = new Map<string, Map<string, number>>();
  const beat = (winner: string, loser: string) => {
    const row = h2h.get(winner) ?? new Map<string, number>();
    row.set(loser, (row.get(loser) ?? 0) + 1);
    h2h.set(winner, row);
  };

  for (const m of matches) {
    if (m.pair1Score == null || m.pair2Score == null) continue;
    const s1 = stats.get(m.pair1Id);
    const s2 = stats.get(m.pair2Id);
    if (!s1 || !s2) continue;
    s1.matchesPlayed += 1;
    s2.matchesPlayed += 1;
    if (m.pair1Score > m.pair2Score) { s1.wins += 1; beat(m.pair1Id, m.pair2Id); }
    else if (m.pair2Score > m.pair1Score) { s2.wins += 1; beat(m.pair2Id, m.pair1Id); }
  }

  const beatCount = (a: string, b: string) => h2h.get(a)?.get(b) ?? 0;
  const all = [...stats.values()].sort((a, b) => b.wins - a.wins);
  const mini = new Map<string, number>();
  const ordered: PairStanding[] = [];

  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length && all[j].wins === all[i].wins) j += 1;
    const group = all.slice(i, j);
    for (const p of group) {
      mini.set(p.pairId, group.reduce((sum, q) => (q.pairId === p.pairId ? sum : sum + beatCount(p.pairId, q.pairId)), 0));
    }
    group.sort((a, b) => (mini.get(b.pairId) ?? 0) - (mini.get(a.pairId) ?? 0) || b.matchesPlayed - a.matchesPlayed || a.pairId.localeCompare(b.pairId));
    ordered.push(...group);
    i = j;
  }

  ordered.forEach((s, index) => {
    if (index === 0) { s.place = 1; return; }
    const prev = ordered[index - 1];
    const tie = prev.wins === s.wins && mini.get(prev.pairId) === mini.get(s.pairId) && prev.matchesPlayed === s.matchesPlayed;
    s.place = tie ? prev.place : index + 1;
  });

  return ordered;
}
