import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TournamentParticipantStatus, TournamentStatus, UserRole } from "@/lib/statuses";
import { computeStandings, generateAmericanoRounds, validateAmericanoPlayers } from "@/lib/americano";
import { computePairStandings, generateFixedPairsRounds, validateFixedPairs, type FixedPair, type PairStandingMatch } from "@/lib/fixed-pairs";
import { HIDDEN_USER_FILTER } from "@/lib/users";

type AdminUser = { id: string; role: string };

export const TournamentFormat = { MINI: "MINI", AMERICANO: "AMERICANO", MEXICANO: "MEXICANO", FIXED_PAIRS: "FIXED_PAIRS" } as const;

// New Tournament relations/fields aren't in the sandbox Prisma client yet; the
// casts below are resolved by `prisma generate` on a machine with network access.
function roundModel() {
  return (prisma as unknown as { tournamentRound: any }).tournamentRound;
}
function matchModel() {
  return (prisma as unknown as { tournamentMatch: any }).tournamentMatch;
}

export type RankingPlayer = {
  userId: string;
  name: string;
  lastName: string;
  photoUrl: string | null;
  totalPoints: number;
  tournamentsPlayed: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  bestPlace: number | null;
  titles: number;
};

export function tournamentPoints(matchesPlayed: number, wins: number) {
  const losses = matchesPlayed - wins;
  return wins * 5 + losses;
}

export function winRate(matchesPlayed: number, wins: number) {
  return matchesPlayed === 0 ? 0 : (wins / matchesPlayed) * 100;
}

export function validateTournamentResult(matchesPlayed: number, wins: number) {
  if (!Number.isInteger(matchesPlayed) || matchesPlayed < 0) {
    throw new Error("Количество матчей не может быть меньше 0");
  }
  if (!Number.isInteger(wins) || wins < 0) {
    throw new Error("Количество побед не может быть меньше 0");
  }
  if (wins > matchesPlayed) {
    throw new Error("Победы не могут быть больше количества матчей");
  }
}

export async function createTournament(input: {
  title: string;
  startsAt?: Date;
  city?: string;
  club?: string;
  createdById: string;
  format?: string;
  courts?: number;
  pointsPerMatch?: number;
}) {
  const { format, courts, pointsPerMatch, ...rest } = input;
  const tournament = await prisma.tournament.create({
    data: {
      ...rest,
      status: TournamentStatus.OPEN,
      format: format ?? TournamentFormat.MINI
    } as unknown as Prisma.TournamentCreateInput
  });

  const nextCourts = courts ?? 1;
  const nextPointsPerMatch = pointsPerMatch ?? 24;
  if (nextCourts !== 1 || nextPointsPerMatch !== 24) {
    await prisma.$executeRaw`
      UPDATE "Tournament"
      SET "courts" = ${nextCourts}, "pointsPerMatch" = ${nextPointsPerMatch}
      WHERE "id" = ${tournament.id}
    `;
  }

  return tournament;
}

export async function updateTournament(
  tournamentId: string,
  input: { title: string; startsAt?: Date; city?: string; club?: string },
  admin: AdminUser
) {
  assertAdmin(admin);
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Турнир не найден");

  return prisma.tournament.update({
    where: { id: tournamentId },
    data: input
  });
}

export async function deleteTournament(tournamentId: string, admin: AdminUser) {
  assertAdmin(admin);
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Турнир не найден");
  // Admins may delete any tournament (incl. completed); participations, rounds and
  // matches cascade, and the live ranking recalculates without it.
  return prisma.tournament.delete({ where: { id: tournamentId } });
}

export async function addTournamentParticipant(tournamentId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Tournament not found");
    if (!isTournamentRegistrationOpen(tournament.status)) throw new Error("Tournament registration is closed");
    if ((tournament as { scheduleReady?: boolean }).scheduleReady) throw new Error("Регистрация закрыта: расписание уже сформировано");

    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, deactivatedAt: true } });
    if (!user) throw new Error("Player not found");
    if (user.deactivatedAt) throw new Error("Cannot add a deactivated player");

    const existing = await tx.tournamentParticipation.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
      select: { status: true }
    });
    if (existing?.status === TournamentParticipantStatus.JOINED) {
      throw new Error("You are already registered for this tournament");
    }
    if (existing?.status === TournamentParticipantStatus.WAITING) {
      throw new Error("You are already on the waitlist");
    }

    const participation = await tx.tournamentParticipation.upsert({
      where: { tournamentId_userId: { tournamentId, userId } },
      update: { status: TournamentParticipantStatus.JOINED },
      create: { tournamentId, userId, status: TournamentParticipantStatus.JOINED }
    });
    await syncTournamentWaitlist(tx, tournamentId);
    return participation;
  });
}

export async function removeTournamentParticipant(tournamentId: string, userId: string, admin: AdminUser) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { status: true }
    });
    if (!tournament) throw new Error("Турнир не найден");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Нельзя менять участников завершенного турнира");

    await tx.tournamentParticipation.update({
      where: { tournamentId_userId: { tournamentId, userId } },
      data: {
        status: TournamentParticipantStatus.REMOVED,
        matchesPlayed: 0,
        wins: 0,
        tournamentPoints: 0,
        place: null
      }
    });
    await syncTournamentWaitlist(tx, tournamentId);
  });
}

export async function updateTournamentResult(
  participationId: string,
  input: { matchesPlayed: number; wins: number },
  admin: AdminUser
) {
  assertAdmin(admin);
  validateTournamentResult(input.matchesPlayed, input.wins);

  return prisma.$transaction(async (tx) => {
    const participation = await tx.tournamentParticipation.findUnique({
      where: { id: participationId },
      include: { tournament: { select: { status: true } } }
    });
    if (!participation) throw new Error("Участник турнира не найден");
    if (participation.status === TournamentParticipantStatus.REMOVED) throw new Error("Игрок удален из турнира");
    if (participation.tournament.status === TournamentStatus.COMPLETED) throw new Error("Результаты завершенного турнира нельзя менять");

    return tx.tournamentParticipation.update({
      where: { id: participationId },
      data: {
        matchesPlayed: input.matchesPlayed,
        wins: input.wins,
        tournamentPoints: tournamentPoints(input.matchesPlayed, input.wins)
      }
    });
  });
}

export async function completeTournament(tournamentId: string, admin: AdminUser) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          where: { status: TournamentParticipantStatus.JOINED },
          include: { user: { select: { name: true, lastName: true } } }
        }
      }
    });
    if (!tournament) throw new Error("Турнир не найден");
    if (tournament.status === TournamentStatus.COMPLETED) return tournament;
    if (tournament.participants.length === 0) throw new Error("Нельзя завершить турнир без участников");

    for (const participant of tournament.participants) {
      validateTournamentResult(participant.matchesPlayed, participant.wins);
    }

    const ranked = sortTournamentParticipants(tournament.participants);
    await Promise.all(
      ranked.map((participant, index) =>
        tx.tournamentParticipation.update({
          where: { id: participant.id },
          data: {
            tournamentPoints: tournamentPoints(participant.matchesPlayed, participant.wins),
            place: index + 1
          }
        })
      )
    );

    return tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.COMPLETED,
        completedAt: new Date()
      }
    });
  });
}

export async function getTournamentRanking(opts?: { year?: number }): Promise<RankingPlayer[]> {
  const yearFilter = opts?.year
    ? { completedAt: { gte: new Date(opts.year, 0, 1), lt: new Date(opts.year + 1, 0, 1) } }
    : {};
  const participations = await prisma.tournamentParticipation.findMany({
    where: {
      status: TournamentParticipantStatus.JOINED,
      tournament: { status: TournamentStatus.COMPLETED, ...yearFilter },
      user: HIDDEN_USER_FILTER
    },
    include: {
      user: { select: { id: true, name: true, lastName: true, photoUrl: true } }
    }
  });

  const byTournament = new Map<string, typeof participations>();
  for (const participation of participations) {
    const tournamentParticipations = byTournament.get(participation.tournamentId) ?? [];
    tournamentParticipations.push(participation);
    byTournament.set(participation.tournamentId, tournamentParticipations);
  }

  const byUser = new Map<string, RankingPlayer>();
  for (const tournamentParticipations of byTournament.values()) {
    const rankedParticipations = sortTournamentParticipants(tournamentParticipations);

    for (const [index, participation] of rankedParticipations.entries()) {
      const current = byUser.get(participation.userId) ?? {
        userId: participation.userId,
        name: participation.user.name,
        lastName: participation.user.lastName,
        photoUrl: participation.user.photoUrl,
        totalPoints: 0,
        tournamentsPlayed: 0,
        matchesPlayed: 0,
        wins: 0,
        winRate: 0,
        bestPlace: null,
        titles: 0
      };

      current.totalPoints += tournamentPoints(participation.matchesPlayed, participation.wins);
      current.matchesPlayed += participation.matchesPlayed;
      current.wins += participation.wins;
      if (participation.matchesPlayed > 0) current.tournamentsPlayed += 1;
      const place = index + 1;
      current.bestPlace = current.bestPlace === null ? place : Math.min(current.bestPlace, place);
      if (place === 1) current.titles += 1;
      byUser.set(participation.userId, current);
    }
  }

  return Array.from(byUser.values())
    .map((player) => ({
      ...player,
      winRate: winRate(player.matchesPlayed, player.wins)
    }))
    .sort(compareRankingPlayers);
}

export async function getPlayerTournamentStats(userId: string) {
  const ranking = await getTournamentRanking();
  const player = ranking.find((entry) => entry.userId === userId);
  if (!player) {
    return {
      place: null,
      totalPoints: 0,
      tournamentsPlayed: 0,
      matchesPlayed: 0,
      wins: 0,
      winRate: 0,
      bestPlace: null
    };
  }
  return {
    place: ranking.findIndex((entry) => entry.userId === userId) + 1,
    totalPoints: player.totalPoints,
    tournamentsPlayed: player.tournamentsPlayed,
    matchesPlayed: player.matchesPlayed,
    wins: player.wins,
    winRate: player.winRate,
    bestPlace: player.bestPlace
  };
}

export function compareRankingPlayers(a: RankingPlayer, b: RankingPlayer) {
  return b.totalPoints - a.totalPoints
    || b.winRate - a.winRate
    || b.wins - a.wins
    || b.matchesPlayed - a.matchesPlayed
    || `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`, "ru");
}

export function sortTournamentParticipants<T extends {
  matchesPlayed: number;
  wins: number;
  user: { name: string; lastName: string };
}>(participants: T[]) {
  return [...participants].sort((a, b) =>
    tournamentPoints(b.matchesPlayed, b.wins) - tournamentPoints(a.matchesPlayed, a.wins)
    || winRate(b.matchesPlayed, b.wins) - winRate(a.matchesPlayed, a.wins)
    || b.wins - a.wins
    || b.matchesPlayed - a.matchesPlayed
    || `${a.user.name} ${a.user.lastName}`.localeCompare(`${b.user.name} ${b.user.lastName}`, "ru")
  );
}

export async function syncTournamentWaitlist(tx: Prisma.TransactionClient, tournamentId: string) {
  const participants = await tx.tournamentParticipation.findMany({
    where: {
      tournamentId,
      status: { in: [TournamentParticipantStatus.JOINED, TournamentParticipantStatus.WAITING] }
    },
    orderBy: { createdAt: "asc" }
  });
  const waitingId = participants.length % 2 === 1 ? participants[participants.length - 1]?.id : null;

  await Promise.all(
    participants.map((participant) =>
      tx.tournamentParticipation.update({
        where: { id: participant.id },
        data: {
          status: participant.id === waitingId ? TournamentParticipantStatus.WAITING : TournamentParticipantStatus.JOINED
        }
      })
    )
  );
}

function isTournamentRegistrationOpen(status: string) {
  return status === TournamentStatus.OPEN;
}

function assertAdmin(user: AdminUser) {
  if (user.role !== UserRole.ADMIN) throw new Error("Только админ может управлять турнирами");
}

// ---- Americano format ----

export async function generateAmericanoSchedule(tournamentId: string, admin: AdminUser, opts?: { shuffle?: boolean }) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: { where: { status: TournamentParticipantStatus.JOINED }, orderBy: { createdAt: "asc" }, select: { userId: true } }
      }
    });
    if (!tournament) throw new Error("Турнир не найден");
    if ((tournament as { format: string }).format !== TournamentFormat.AMERICANO) throw new Error("Расписание доступно только для Americano");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Турнир уже завершён");

    const txRound = (tx as unknown as { tournamentRound: any }).tournamentRound;
    const txMatch = (tx as unknown as { tournamentMatch: any }).tournamentMatch;

    // Never wipe entered results: regeneration is only allowed before any score.
    const existing = await txMatch.findMany({ where: { tournamentId }, select: { team1Score: true, team2Score: true } });
    if (existing.some((m: { team1Score: number | null; team2Score: number | null }) => m.team1Score != null || m.team2Score != null)) {
      throw new Error("Нельзя перегенерировать: уже введены результаты матчей");
    }

    const playerIds = tournament.participants.map((p) => p.userId);
    const error = validateAmericanoPlayers(playerIds);
    if (error) throw new Error(error);

    if (opts?.shuffle) {
      for (let k = playerIds.length - 1; k > 0; k -= 1) {
        const r = Math.floor(Math.random() * (k + 1));
        [playerIds[k], playerIds[r]] = [playerIds[r], playerIds[k]];
      }
    }

    const courts = (tournament as { courts?: number }).courts ?? 1;
    const rounds = generateAmericanoRounds(playerIds, courts);

    await txRound.deleteMany({ where: { tournamentId } });

    for (const round of rounds) {
      const created = await txRound.create({ data: { tournamentId, number: round.number } });
      if (round.matches.length) {
        await txMatch.createMany({
          data: round.matches.map((m) => ({
            tournamentId,
            roundId: created.id,
            court: m.court,
            team1aId: m.team1[0],
            team1bId: m.team1[1],
            team2aId: m.team2[0],
            team2bId: m.team2[1]
          }))
        });
      }
    }
    await tx.tournament.update({ where: { id: tournamentId }, data: { scheduleReady: true } as unknown as Prisma.TournamentUpdateInput });
    return { rounds: rounds.length };
  });
}

export async function setAmericanoMatchScore(matchId: string, team1Score: number, team2Score: number, admin: AdminUser) {
  assertAdmin(admin);
  if (![team1Score, team2Score].every((v) => Number.isInteger(v) && v >= 0)) {
    throw new Error("Счёт должен быть неотрицательным целым числом");
  }
  return matchModel().update({ where: { id: matchId }, data: { team1Score, team2Score } });
}

export async function completeAmericanoTournament(tournamentId: string, admin: AdminUser) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { where: { status: TournamentParticipantStatus.JOINED }, select: { id: true, userId: true } } }
    });
    if (!tournament) throw new Error("Турнир не найден");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Турнир уже завершён");

    const txMatch = (tx as unknown as { tournamentMatch: any }).tournamentMatch;
    const matches = await txMatch.findMany({ where: { tournamentId } });
    if (!matches.length) throw new Error("Сначала сгенерируйте расписание");
    if (matches.some((m: { team1Score: number | null; team2Score: number | null }) => m.team1Score == null || m.team2Score == null)) {
      throw new Error("Впишите счёт всех матчей перед завершением");
    }

    const playerIds = tournament.participants.map((p) => p.userId);
    const standings = computeStandings(playerIds, matches);
    const byUser = new Map(standings.map((s) => [s.userId, { place: s.place, matchesPlayed: s.matchesPlayed, wins: s.wins }]));

    await Promise.all(
      tournament.participants.map((p) => {
        const s = byUser.get(p.userId);
        const matchesPlayed = s?.matchesPlayed ?? 0;
        const wins = s?.wins ?? 0;
        return tx.tournamentParticipation.update({
          where: { id: p.id },
          data: { place: s?.place ?? null, matchesPlayed, wins, tournamentPoints: tournamentPoints(matchesPlayed, wins) }
        });
      })
    );

    return tx.tournament.update({ where: { id: tournamentId }, data: { status: TournamentStatus.COMPLETED, completedAt: new Date() } });
  });
}

export async function getAmericanoData(tournamentId: string) {
  const [rounds, participants] = await Promise.all([
    roundModel().findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      include: { matches: { orderBy: { court: "asc" } } }
    }),
    prisma.tournamentParticipation.findMany({
      where: { tournamentId, status: TournamentParticipantStatus.JOINED },
      include: { user: { select: { id: true, name: true, lastName: true, photoUrl: true } } }
    })
  ]);

  const allMatches = (rounds as { matches: any[] }[]).flatMap((r) => r.matches);
  const playerIds = participants.map((p) => p.userId);
  const standings = computeStandings(playerIds, allMatches);
  const names = new Map(participants.map((p) => [p.userId, { name: p.user.name, lastName: p.user.lastName, photoUrl: p.user.photoUrl }]));

  return { rounds, standings, participants, names };
}

// ---- Fixed-pairs format (round robin) ----

/** Stable pair id from the two member ids (order-independent). */
export function pairKey(a: string, b: string) {
  return [a, b].sort().join("~");
}

type PairingParticipant = { id: string; userId: string; partnerId: string | null };

/** Form FixedPair[] from joined participants whose partnerId points to another
 * joined participant. Each pair appears once; unpaired players are ignored. */
function buildPairs(participants: PairingParticipant[]): FixedPair[] {
  const joined = new Set(participants.map((p) => p.userId));
  const pairs = new Map<string, FixedPair>();
  for (const p of participants) {
    if (!p.partnerId || !joined.has(p.partnerId)) continue;
    const key = pairKey(p.userId, p.partnerId);
    if (pairs.has(key)) continue;
    const [player1, player2] = [p.userId, p.partnerId].sort();
    pairs.set(key, { id: key, player1, player2 });
  }
  return [...pairs.values()];
}

export async function setTournamentPair(tournamentId: string, user1Id: string, user2Id: string, admin: AdminUser) {
  assertAdmin(admin);
  if (user1Id === user2Id) throw new Error("В паре должны быть два разных игрока");
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Турнир не найден");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Турнир уже завершён");
    if ((tournament as { scheduleReady?: boolean }).scheduleReady) throw new Error("Расписание уже сформировано");

    const both = await tx.tournamentParticipation.findMany({
      where: { tournamentId, userId: { in: [user1Id, user2Id] }, status: TournamentParticipantStatus.JOINED }
    });
    if (both.length !== 2) throw new Error("Оба игрока должны быть среди участников");
    const partnered = both.find((p) => (p as { partnerId?: string | null }).partnerId);
    if (partnered) throw new Error("Сначала разбейте существующую пару");

    await tx.tournamentParticipation.updateMany({ where: { tournamentId, userId: user1Id }, data: { partnerId: user2Id } as never });
    await tx.tournamentParticipation.updateMany({ where: { tournamentId, userId: user2Id }, data: { partnerId: user1Id } as never });
  });
}

export async function clearTournamentPair(tournamentId: string, userId: string, admin: AdminUser) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Турнир не найден");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Турнир уже завершён");
    if ((tournament as { scheduleReady?: boolean }).scheduleReady) throw new Error("Расписание уже сформировано");

    const me = await tx.tournamentParticipation.findUnique({ where: { tournamentId_userId: { tournamentId, userId } } });
    const partnerId = (me as { partnerId?: string | null } | null)?.partnerId ?? null;
    await tx.tournamentParticipation.updateMany({ where: { tournamentId, userId }, data: { partnerId: null } as never });
    if (partnerId) await tx.tournamentParticipation.updateMany({ where: { tournamentId, userId: partnerId }, data: { partnerId: null } as never });
  });
}

/** Self-registration for fixed-pairs: optionally bring a partner. No individual
 * waitlist — pairing/parity is managed explicitly. */
export async function joinFixedPairsTournament(tournamentId: string, userId: string, partnerId?: string | null) {
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new Error("Турнир не найден");
    if ((tournament as { format: string }).format !== TournamentFormat.FIXED_PAIRS) throw new Error("Неверный формат турнира");
    if (!isTournamentRegistrationOpen(tournament.status)) throw new Error("Регистрация закрыта");
    if ((tournament as { scheduleReady?: boolean }).scheduleReady) throw new Error("Регистрация закрыта: расписание уже сформировано");

    if (partnerId && partnerId === userId) throw new Error("Нельзя выбрать себя напарником");

    const ensureUser = async (id: string) => {
      const u = await tx.user.findUnique({ where: { id }, select: { id: true, deactivatedAt: true } });
      if (!u) throw new Error("Игрок не найден");
      if (u.deactivatedAt) throw new Error("Игрок деактивирован");
    };
    await ensureUser(userId);
    if (partnerId) await ensureUser(partnerId);

    const upsertJoined = (id: string, partner: string | null) =>
      tx.tournamentParticipation.upsert({
        where: { tournamentId_userId: { tournamentId, userId: id } },
        update: { status: TournamentParticipantStatus.JOINED, partnerId: partner } as never,
        create: { tournamentId, userId: id, status: TournamentParticipantStatus.JOINED, partnerId: partner } as never
      });

    if (partnerId) {
      const existingPartner = await tx.tournamentParticipation.findUnique({
        where: { tournamentId_userId: { tournamentId, userId: partnerId } }
      });
      const partnerBusy = (existingPartner as { partnerId?: string | null } | null)?.partnerId;
      if (partnerBusy && partnerBusy !== userId) throw new Error("Напарник уже в другой паре");
      await upsertJoined(userId, partnerId);
      await upsertJoined(partnerId, userId);
    } else {
      await upsertJoined(userId, null);
    }
  });
}

export async function generateFixedPairsSchedule(tournamentId: string, admin: AdminUser, opts?: { shuffle?: boolean }) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          where: { status: TournamentParticipantStatus.JOINED },
          orderBy: { createdAt: "asc" },
          select: { id: true, userId: true, partnerId: true } as never
        }
      }
    });
    if (!tournament) throw new Error("Турнир не найден");
    if ((tournament as { format: string }).format !== TournamentFormat.FIXED_PAIRS) throw new Error("Доступно только для турнира по парам");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Турнир уже завершён");

    const txRound = (tx as unknown as { tournamentRound: any }).tournamentRound;
    const txMatch = (tx as unknown as { tournamentMatch: any }).tournamentMatch;

    const existing = await txMatch.findMany({ where: { tournamentId }, select: { team1Score: true, team2Score: true } });
    if (existing.some((m: { team1Score: number | null; team2Score: number | null }) => m.team1Score != null || m.team2Score != null)) {
      throw new Error("Нельзя перегенерировать: уже введены результаты матчей");
    }

    const participants = tournament.participants as unknown as PairingParticipant[];
    const unpaired = participants.filter((p) => !p.partnerId);
    if (unpaired.length) throw new Error("Сначала разбейте всех участников на пары");
    let pairs = buildPairs(participants);
    const error = validateFixedPairs(pairs);
    if (error) throw new Error(error);

    if (opts?.shuffle) {
      for (let k = pairs.length - 1; k > 0; k -= 1) {
        const r = Math.floor(Math.random() * (k + 1));
        [pairs[k], pairs[r]] = [pairs[r], pairs[k]];
      }
    }

    const byKey = new Map(pairs.map((p) => [p.id, p]));
    const courts = (tournament as { courts?: number }).courts ?? 1;
    const rounds = generateFixedPairsRounds(pairs, courts);

    await txRound.deleteMany({ where: { tournamentId } });
    for (const round of rounds) {
      const created = await txRound.create({ data: { tournamentId, number: round.number } });
      if (round.matches.length) {
        await txMatch.createMany({
          data: round.matches.map((m) => {
            const p1 = byKey.get(m.pair1)!;
            const p2 = byKey.get(m.pair2)!;
            return {
              tournamentId,
              roundId: created.id,
              court: m.court,
              team1aId: p1.player1,
              team1bId: p1.player2,
              team2aId: p2.player1,
              team2bId: p2.player2
            };
          })
        });
      }
    }
    await tx.tournament.update({ where: { id: tournamentId }, data: { scheduleReady: true } as unknown as Prisma.TournamentUpdateInput });
    return { rounds: rounds.length, pairs: pairs.length };
  });
}

function pairStandingMatches(matches: { team1aId: string; team1bId: string; team2aId: string; team2bId: string; team1Score: number | null; team2Score: number | null }[]): PairStandingMatch[] {
  return matches.map((m) => ({
    pair1Id: pairKey(m.team1aId, m.team1bId),
    pair2Id: pairKey(m.team2aId, m.team2bId),
    pair1Score: m.team1Score,
    pair2Score: m.team2Score
  }));
}

export async function completeFixedPairsTournament(tournamentId: string, admin: AdminUser) {
  assertAdmin(admin);
  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: { where: { status: TournamentParticipantStatus.JOINED }, select: { id: true, userId: true, partnerId: true } as never } }
    });
    if (!tournament) throw new Error("Турнир не найден");
    if (tournament.status === TournamentStatus.COMPLETED) throw new Error("Турнир уже завершён");

    const txMatch = (tx as unknown as { tournamentMatch: any }).tournamentMatch;
    const matches = await txMatch.findMany({ where: { tournamentId } });
    if (!matches.length) throw new Error("Сначала сгенерируйте расписание");
    if (matches.some((m: { team1Score: number | null; team2Score: number | null }) => m.team1Score == null || m.team2Score == null)) {
      throw new Error("Впишите счёт всех матчей перед завершением");
    }

    const participants = tournament.participants as unknown as PairingParticipant[];
    const pairs = buildPairs(participants);
    const standings = computePairStandings(pairs.map((p) => p.id), pairStandingMatches(matches));
    const byPair = new Map(standings.map((s) => [s.pairId, s]));

    await Promise.all(
      participants.map((p) => {
        const s = p.partnerId ? byPair.get(pairKey(p.userId, p.partnerId)) : undefined;
        const matchesPlayed = s?.matchesPlayed ?? 0;
        const wins = s?.wins ?? 0;
        return tx.tournamentParticipation.update({
          where: { id: p.id },
          data: { place: s?.place ?? null, matchesPlayed, wins, tournamentPoints: tournamentPoints(matchesPlayed, wins) }
        });
      })
    );

    return tx.tournament.update({ where: { id: tournamentId }, data: { status: TournamentStatus.COMPLETED, completedAt: new Date() } });
  });
}

export type FixedPairStanding = {
  pairId: string;
  place: number;
  wins: number;
  matchesPlayed: number;
  players: { id: string; name: string; lastName: string; photoUrl: string | null }[];
};

export async function getFixedPairsData(tournamentId: string) {
  const [rounds, participants] = await Promise.all([
    roundModel().findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      include: { matches: { orderBy: { court: "asc" } } }
    }),
    prisma.tournamentParticipation.findMany({
      where: { tournamentId, status: TournamentParticipantStatus.JOINED },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, lastName: true, photoUrl: true } } }
    })
  ]);

  const userInfo = new Map(participants.map((p) => [p.userId, p.user]));
  const names = new Map(participants.map((p) => [p.userId, { name: p.user.name, lastName: p.user.lastName, photoUrl: p.user.photoUrl }]));
  const pairingParticipants = participants.map((p) => ({ id: p.id, userId: p.userId, partnerId: (p as { partnerId?: string | null }).partnerId ?? null }));
  const pairs = buildPairs(pairingParticipants);
  const unpaired = pairingParticipants.filter((p) => !p.partnerId);

  const allMatches = (rounds as { matches: any[] }[]).flatMap((r) => r.matches);
  const rawStandings = computePairStandings(pairs.map((p) => p.id), pairStandingMatches(allMatches));
  const standings: FixedPairStanding[] = rawStandings.map((s) => {
    const pair = pairs.find((p) => p.id === s.pairId)!;
    return {
      pairId: s.pairId,
      place: s.place,
      wins: s.wins,
      matchesPlayed: s.matchesPlayed,
      players: [pair.player1, pair.player2].map((id) => {
        const u = userInfo.get(id);
        return { id, name: u?.name ?? "?", lastName: u?.lastName ?? "", photoUrl: u?.photoUrl ?? null };
      })
    };
  });

  return { rounds, standings, participants, names, pairs, unpaired };
}
