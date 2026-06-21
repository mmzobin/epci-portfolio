/**
 * Americano scheduling engine (pure, no DB).
 *
 * Americano = individual format where everyone partners everyone once.
 * We build a 1-factorization of the players (circle / round-robin method):
 * N-1 rounds, each a perfect matching into N/2 teams of two. Teams are then
 * grouped two-by-two into matches (2 courts worth of 4 players each).
 *
 * Edge cases:
 *  - Requires an even number of players, at least 4 (validateAmericanoPlayers).
 *  - When N is even but not divisible by 4 (6, 10, …) each round has an odd
 *    number of teams, so one team sits out that round (a rotating "bye").
 *  - Standings only count matches with both scores entered.
 *
 * Future Mexicano can reuse computeStandings + the match shape, generating the
 * next round adaptively from current standings instead of a fixed schedule.
 */

export type Pair = [string, string];

export type EngineMatch = { team1: Pair; team2: Pair; court: number };
export type EngineRound = { number: number; matches: EngineMatch[]; resting: Pair | null };

export function validateAmericanoPlayers(playerIds: string[]): string | null {
  if (playerIds.length < 4) return "Для Americano нужно минимум 4 игрока";
  if (playerIds.length % 2 !== 0) return "Для Americano нужно чётное число игроков";
  return null;
}

/** Round-robin 1-factorization: every player partners every other exactly once. */
function partnerRounds(players: string[]): Pair[][] {
  const n = players.length;
  const fixed = players[0];
  let rest = players.slice(1); // length n-1
  const rounds: Pair[][] = [];

  for (let r = 0; r < n - 1; r += 1) {
    const pairs: Pair[] = [[fixed, rest[0]]];
    for (let i = 1; i <= (n - 2) / 2; i += 1) {
      pairs.push([rest[i], rest[rest.length - i]]);
    }
    rounds.push(pairs);
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }
  return rounds;
}

export function generateAmericanoRounds(players: string[], courts = 1): EngineRound[] {
  const error = validateAmericanoPlayers(players);
  if (error) throw new Error(error);
  const courtCount = Math.max(1, courts);

  return partnerRounds(players).map((teams, index) => {
    const matches: EngineMatch[] = [];
    let court = 1;
    for (let i = 0; i + 1 < teams.length; i += 2) {
      matches.push({ team1: teams[i], team2: teams[i + 1], court });
      court = (court % courtCount) + 1;
    }
    const resting = teams.length % 2 === 1 ? teams[teams.length - 1] : null;
    return { number: index + 1, matches, resting };
  });
}

export type StandingMatch = {
  team1aId: string;
  team1bId: string;
  team2aId: string;
  team2bId: string;
  team1Score: number | null;
  team2Score: number | null;
};

export type Standing = { userId: string; points: number; matchesPlayed: number; wins: number; place: number };

/** Per-player totals from match scores (only completed matches count).
 * Places use standard competition ranking (1, 1, 3 …): players who can't be
 * separated by wins or head-to-head share the same place. */
export function computeStandings(playerIds: string[], matches: StandingMatch[]): Standing[] {
  const stats = new Map<string, Standing>(playerIds.map((id) => [id, { userId: id, points: 0, matchesPlayed: 0, wins: 0, place: 0 }]));
  // Head-to-head: how many times A beat B as direct opponents (tie-breaker).
  const h2h = new Map<string, Map<string, number>>();
  const beat = (winner: string, loser: string) => {
    const row = h2h.get(winner) ?? new Map<string, number>();
    row.set(loser, (row.get(loser) ?? 0) + 1);
    h2h.set(winner, row);
  };

  for (const m of matches) {
    if (m.team1Score == null || m.team2Score == null) continue;
    const team1 = [m.team1aId, m.team1bId];
    const team2 = [m.team2aId, m.team2bId];
    const team1Won = m.team1Score > m.team2Score;
    const team2Won = m.team2Score > m.team1Score;
    for (const id of team1) {
      const s = stats.get(id);
      if (s) { s.points += m.team1Score; s.matchesPlayed += 1; if (team1Won) s.wins += 1; }
    }
    for (const id of team2) {
      const s = stats.get(id);
      if (s) { s.points += m.team2Score; s.matchesPlayed += 1; if (team2Won) s.wins += 1; }
    }
    const winners = team1Won ? team1 : team2Won ? team2 : [];
    const losers = team1Won ? team2 : team2Won ? team1 : [];
    for (const w of winners) for (const l of losers) beat(w, l);
  }

  const beatCount = (a: string, b: string) => h2h.get(a)?.get(b) ?? 0;

  // Order by wins first, then resolve ties INSIDE each equal-wins group by a
  // mini head-to-head league (wins only against the other tied players). Players
  // who are still perfectly level share the same place.
  const all = [...stats.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
  const mini = new Map<string, number>();
  const ordered: Standing[] = [];

  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length && all[j].points === all[i].points && all[j].wins === all[i].wins) j += 1;
    const group = all.slice(i, j);
    for (const p of group) {
      mini.set(p.userId, group.reduce((sum, q) => (q.userId === p.userId ? sum : sum + beatCount(p.userId, q.userId)), 0));
    }
    group.sort((a, b) => (mini.get(b.userId) ?? 0) - (mini.get(a.userId) ?? 0) || b.matchesPlayed - a.matchesPlayed || a.userId.localeCompare(b.userId));
    ordered.push(...group);
    i = j;
  }

  ordered.forEach((s, index) => {
    if (index === 0) {
      s.place = 1;
      return;
    }
    const prev = ordered[index - 1];
    const tie = prev.points === s.points && prev.wins === s.wins && mini.get(prev.userId) === mini.get(s.userId) && prev.matchesPlayed === s.matchesPlayed;
    s.place = tie ? prev.place : index + 1;
  });

  return ordered;
}
