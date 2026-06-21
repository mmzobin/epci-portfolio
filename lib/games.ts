import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyCourtBooked, notifyCourtBookedGroup, notifyGameFull, notifyGameJoined, notifyGuestBumped, notifyLastSpot } from "@/lib/telegram-bot";
import { getEffectiveMatchStatus } from "@/lib/action-states";
import { effectiveRating, isLevelInRange, levelRangeErrorMessage } from "@/lib/levels";
import { appNow } from "@/lib/app-time";
import { GameStatus, type GameStatus as GameStatusType, ParticipationStatus, type ParticipationStatus as ParticipationStatusType, PaymentStatus, type PaymentStatus as PaymentStatusType, UserRole } from "@/lib/statuses";

const activePlayerStatuses: readonly string[] = [
  ParticipationStatus.JOINED,
  ParticipationStatus.PLAYED,
  ParticipationStatus.NO_SHOW
];

const paymentEligibleStatuses: readonly string[] = [
  ParticipationStatus.JOINED,
  ParticipationStatus.PLAYED,
  ParticipationStatus.NO_SHOW
];

type GameManager = { id: string; role: string };

export const MAX_GUESTS_PER_MEMBER = 2;

// Guest model isn't in the sandbox Prisma client yet; resolved by `prisma generate`.
function guestModel() {
  return (prisma as unknown as { guest: any }).guest;
}
function txGuest(tx: Prisma.TransactionClient) {
  return (tx as unknown as { guest: any }).guest;
}

// Eligibility uses the live rating (skillRating ?? level). The sandbox Prisma
// client predates skillRating, so we add it to selects via this cast (it's
// present at runtime) and read it through `userRating`.
function withRating<T extends object>(select: T): T {
  return { ...select, skillRating: true } as unknown as T;
}
function userRating(user: { level: number }) {
  return effectiveRating(user as { skillRating?: number | null; level: number });
}

function canManageGame(manager: GameManager, game: { organizerId: string }) {
  return manager.role === UserRole.ADMIN || game.organizerId === manager.id;
}

function assertCanManageGame(manager: GameManager, game: { organizerId: string }) {
  if (!canManageGame(manager, game)) {
    throw new Error("You can manage only your own games");
  }
}

function isRosterEditable(status: string) {
  return !([GameStatus.CANCELLED, GameStatus.COMPLETED, GameStatus.DRAFT, GameStatus.EXPIRED] as readonly string[]).includes(status);
}

function isAttendanceEditable(game: { status: string; startsAt: Date }) {
  return game.status === GameStatus.COMPLETED || game.startsAt <= appNow();
}

function validateGameStatusTransition(game: { status: string; startsAt: Date }, nextStatus: GameStatusType, now = appNow()) {
  if (game.status === nextStatus) return;

  if (game.status === GameStatus.COMPLETED) {
    throw new Error("Completed games cannot be reopened or changed");
  }

  if (nextStatus === GameStatus.COMPLETED) {
    // EXPIRED is allowed: it just means the game started while still open/full and
    // hasn't been confirmed yet. The organizer records the result after playing.
    if (!([GameStatus.OPEN, GameStatus.FULL, GameStatus.EXPIRED] as readonly string[]).includes(game.status)) {
      throw new Error("Only open, full or expired games can be completed");
    }
    if (game.startsAt > now) throw new Error("Game can be completed only after it starts");
  }

  if (nextStatus === GameStatus.CANCELLED) {
    if (!([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(game.status)) {
      throw new Error("Only open or full games can be cancelled");
    }
  }

  if (([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(nextStatus)) {
    if (game.status === GameStatus.CANCELLED && game.startsAt <= now) {
      throw new Error("Past cancelled games cannot be reopened");
    }
    if (!([GameStatus.OPEN, GameStatus.FULL, GameStatus.CANCELLED, GameStatus.DRAFT] as readonly string[]).includes(game.status)) {
      throw new Error("Game cannot be opened from its current status");
    }
  }
}

// The DB sweep only persists what getEffectiveMatchStatus already derives at read time,
// so read paths can tolerate a stale status for up to a minute. Sweeping on every read
// added a full DB round-trip per page view. The timestamp lives on globalThis because
// dev mode can instantiate this module once per route bundle (same reason as lib/prisma).
const globalForGames = globalThis as unknown as { lastExpireSweepAt?: number };
const EXPIRE_SWEEP_INTERVAL_MS = 60_000;

async function expirePastUnfinishedGamesThrottled() {
  if (Date.now() - (globalForGames.lastExpireSweepAt ?? 0) < EXPIRE_SWEEP_INTERVAL_MS) return;
  globalForGames.lastExpireSweepAt = Date.now();
  await expirePastUnfinishedGames();
}

// Test reset reseeds past games as OPEN/FULL and expects the next page view to
// sweep them; without this the throttle would keep the stale seed visible.
export function resetExpireSweepThrottle() {
  globalForGames.lastExpireSweepAt = 0;
}

async function attachGuestCounts<T extends { id: string }>(games: T[]): Promise<(T & { guestCount: number })[]> {
  if (!games.length) return [];
  const rows = await guestModel().groupBy({ by: ["gameId"], where: { gameId: { in: games.map((g) => g.id) } }, _count: { _all: true } });
  const counts = new Map<string, number>(rows.map((r: { gameId: string; _count: { _all: number } }) => [r.gameId, r._count._all]));
  return games.map((game) => ({ ...game, guestCount: counts.get(game.id) ?? 0 }));
}

export async function listGames() {
  await expirePastUnfinishedGamesThrottled();
  // Home shows only upcoming, joinable games. Completed / cancelled / expired
  // games are history and don't belong on the landing screen.
  const games = await prisma.game.findMany({
    where: { status: { in: [GameStatus.OPEN, GameStatus.FULL] } },
    orderBy: { startsAt: "asc" },
    include: {
      organizer: { select: { id: true, name: true } },
      participations: { include: { user: { select: { id: true, name: true, lastName: true, photoUrl: true, level: true } } } }
    }
  });
  return attachGuestCounts(games);
}

export async function listOrganizerGames(manager: GameManager) {
  await expirePastUnfinishedGamesThrottled();
  const games = await prisma.game.findMany({
    where: manager.role === UserRole.ADMIN ? undefined : { organizerId: manager.id },
    orderBy: { startsAt: "asc" },
    include: {
      organizer: { select: { id: true, name: true } },
      participations: { include: { user: { select: { id: true, name: true, lastName: true, photoUrl: true, level: true } } } }
    }
  });
  return attachGuestCounts(games);
}

export type GameGuest = { id: string; name: string | null; invitedById: string; invitedBy: { id: string; name: string; lastName: string } };

export async function getGame(id: string) {
  await expirePastUnfinishedGamesThrottled();
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, name: true } },
      participations: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, lastName: true, photoUrl: true, level: true, city: true } } }
      }
    }
  });
  if (!game) return null;
  const guests = (await guestModel().findMany({
    where: { gameId: id },
    orderBy: { createdAt: "asc" },
    include: { invitedBy: { select: { id: true, name: true, lastName: true } } }
  })) as GameGuest[];
  return { ...game, guests };
}

export async function getManageableGame(id: string, manager: GameManager) {
  const game = await getGame(id);
  if (game) assertCanManageGame(manager, game);
  return game;
}

/** Telegram chat ids of active participants who can receive a DM (started the bot). */
async function activeParticipantChatIds(gameId: string): Promise<string[]> {
  const rows = await prisma.participation.findMany({
    where: { gameId, status: { in: [...activePlayerStatuses] } },
    select: { user: { select: { telegramId: true } } }
  });
  return rows.map((r) => r.user.telegramId).filter((t): t is string => Boolean(t));
}

export function joinedCount(game: { participations: { status: string }[]; guests?: unknown[]; guestCount?: number }) {
  const players = game.participations.filter((p) => activePlayerStatuses.includes(p.status)).length;
  const guests = game.guests?.length ?? game.guestCount ?? 0;
  return players + guests;
}

export function waitingCount(game: { participations: { status: string }[] }) {
  return game.participations.filter((p) => p.status === ParticipationStatus.WAITING).length;
}

export async function joinGame(userId: string, gameId: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let filledGame: { title: string; startsAt: Date; city: string; club: string; address: string; maxPlayers: number } | null = null;
    let joinInfo: { title: string; startsAt: Date; city: string; club: string; address: string; maxPlayers: number; joined: number; organizerId: string } | null = null;
    let bumpInfo: { guestName: string | null; invitedById: string; startsAt: Date; city: string; address: string } | null = null;
    let lastSpotGame: { title: string; startsAt: Date; city: string; address: string; maxPlayers: number } | null = null;
    try {
      const participation = await prisma.$transaction(async (tx) => {
        const [game, user] = await Promise.all([
          tx.game.findUnique({
            where: { id: gameId },
            include: { participations: true }
          }),
          tx.user.findUnique({
            where: { id: userId },
            select: withRating({ level: true })
          })
        ]);

        if (!game) throw new Error("Game not found");
        if (!user) throw new Error("User not found");
        const effectiveStatus = getEffectiveMatchStatus(game);
        if (([GameStatus.CANCELLED, GameStatus.COMPLETED, GameStatus.DRAFT, GameStatus.EXPIRED] as readonly string[]).includes(effectiveStatus)) {
          throw new Error("Registration is closed for this game");
        }

        const existing = game.participations.find((p) => p.userId === userId);
        if (existing && activePlayerStatuses.includes(existing.status)) {
          throw new Error("You have already joined this game");
        }
        if (existing?.status === ParticipationStatus.WAITING) {
          throw new Error("You are already on the waitlist");
        }
        if (!isLevelInRange(userRating(user), game.minLevel, game.maxLevel)) {
          throw new Error(levelRangeErrorMessage(userRating(user), game.minLevel, game.maxLevel));
        }

        // Members outrank guests: a joining member always gets a slot, bumping
        // the most recently added guest if the game is full only because of
        // guests — but only until the court is booked (then the line-up is locked).
        const memberActive = game.participations.filter((p) => activePlayerStatuses.includes(p.status)).length;
        const newestGuest = (await txGuest(tx).findMany({ where: { gameId }, orderBy: { createdAt: "desc" }, take: 1 })) as { id: string; name: string | null; invitedById: string }[];
        const guestCount = await txGuest(tx).count({ where: { gameId } });
        const courtBooked = (game as { courtBooked?: boolean }).courtBooked === true;
        const freeSlots = game.maxPlayers - memberActive - guestCount;

        let nextStatus: ParticipationStatusType;
        let bumped: { id: string; name: string | null; invitedById: string } | null = null;
        if (freeSlots > 0) {
          nextStatus = ParticipationStatus.JOINED;
        } else if (guestCount > 0 && !courtBooked && newestGuest[0]) {
          nextStatus = ParticipationStatus.JOINED;
          bumped = newestGuest[0];
        } else {
          nextStatus = ParticipationStatus.WAITING;
        }

        if (bumped) {
          await txGuest(tx).delete({ where: { id: bumped.id } });
          bumpInfo = { guestName: bumped.name, invitedById: bumped.invitedById, startsAt: game.startsAt, city: game.city, address: game.address };
        }

        const guestAfter = guestCount - (bumped ? 1 : 0);
        const activeAfter = memberActive + (nextStatus === ParticipationStatus.JOINED ? 1 : 0) + guestAfter;
        const nextGameStatus = activeAfter >= game.maxPlayers ? GameStatus.FULL : GameStatus.OPEN;
        if (game.status !== GameStatus.FULL && nextGameStatus === GameStatus.FULL) {
          filledGame = { title: game.title, startsAt: game.startsAt, city: game.city, club: game.club, address: game.address, maxPlayers: game.maxPlayers };
        }
        // Scarcity nudge: announce in the group the moment exactly one slot is left
        // (drives FOMO sign-ups without per-join spam). Skip if this join fills it.
        if (nextStatus === ParticipationStatus.JOINED && nextGameStatus !== GameStatus.FULL && activeAfter === game.maxPlayers - 1) {
          lastSpotGame = { title: game.title, startsAt: game.startsAt, city: game.city, address: game.address, maxPlayers: game.maxPlayers };
        }
        // DM the organizer on active joins, unless this join fills the game (then
        // notifyGameFull DMs everyone) or the organizer is the one joining.
        if (nextStatus === ParticipationStatus.JOINED && nextGameStatus !== GameStatus.FULL && game.organizerId !== userId) {
          joinInfo = { title: game.title, startsAt: game.startsAt, city: game.city, club: game.club, address: game.address, maxPlayers: game.maxPlayers, joined: activeAfter, organizerId: game.organizerId };
        }
        const [participation] = await Promise.all([
          tx.participation.upsert({
            where: { userId_gameId: { userId, gameId } },
            update: { status: nextStatus, paymentStatus: PaymentStatus.UNPAID },
            create: { userId, gameId, status: nextStatus, paymentStatus: PaymentStatus.UNPAID }
          }),
          game.status === nextGameStatus
            ? Promise.resolve()
            : tx.game.update({ where: { id: gameId }, data: { status: nextGameStatus } })
        ]);

        return participation;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if (filledGame) {
        try {
          const chatIds = await activeParticipantChatIds(gameId);
          await notifyGameFull(chatIds, filledGame);
        } catch {
          // Notifications must never block joining.
        }
      }
      if (lastSpotGame) {
        try {
          await notifyLastSpot(lastSpotGame);
        } catch {
          // Notifications must never block joining.
        }
      }
      if (joinInfo) {
        const info: { title: string; startsAt: Date; city: string; club: string; address: string; maxPlayers: number; joined: number; organizerId: string } = joinInfo;
        try {
          const [organizer, joiner] = await Promise.all([
            prisma.user.findUnique({ where: { id: info.organizerId }, select: { telegramId: true } }),
            prisma.user.findUnique({ where: { id: userId }, select: { name: true, lastName: true } })
          ]);
          const chatId = (organizer as { telegramId?: string | null } | null)?.telegramId ?? null;
          if (chatId && joiner) await notifyGameJoined(chatId, info, joiner);
        } catch {
          // Notifications must never block joining.
        }
      }
      if (bumpInfo) {
        const info: { guestName: string | null; invitedById: string; startsAt: Date; city: string; address: string } = bumpInfo;
        try {
          const [inviter, joiner] = await Promise.all([
            prisma.user.findUnique({ where: { id: info.invitedById }, select: { telegramId: true } }),
            prisma.user.findUnique({ where: { id: userId }, select: { name: true, lastName: true } })
          ]);
          const chatId = (inviter as { telegramId?: string | null } | null)?.telegramId ?? null;
          if (chatId && joiner) {
            await notifyGuestBumped(chatId, { startsAt: info.startsAt, city: info.city, address: info.address }, info.guestName, joiner);
          }
        } catch {
          // Notifications must never block joining.
        }
      }
      return participation;
    } catch (error) {
      if (attempt === 0 && isTransactionWriteConflict(error)) continue;
      throw error;
    }
  }

  throw new Error("Registration is closed for this game");
}

export async function leaveGame(userId: string, gameId: string) {
  return prisma.$transaction(async (tx) => {
    const participation = await tx.participation.findUnique({
      where: { userId_gameId: { userId, gameId } },
      include: { game: true }
    });

    if (!participation) return null;
    const effectiveStatus = getEffectiveMatchStatus(participation.game);
    if (([GameStatus.CANCELLED, GameStatus.COMPLETED, GameStatus.EXPIRED] as readonly string[]).includes(effectiveStatus)) {
      throw new Error("Game is already closed");
    }

    const wasJoined = participation.status === ParticipationStatus.JOINED;
    const wasActive = activePlayerStatuses.includes(participation.status);
    let promotedWaitingPlayer = false;

    await Promise.all([
      tx.participation.update({
        where: { id: participation.id },
        data: { status: ParticipationStatus.CANCELLED }
      }),
      tx.user.update({ where: { id: userId }, data: { cancellations: { increment: 1 } } })
    ]);

    if (wasJoined) {
      const waiting = await tx.participation.findMany({
        where: { gameId, status: ParticipationStatus.WAITING },
        orderBy: { createdAt: "asc" },
        include: { user: { select: withRating({ level: true }) } }
      });
      const nextWaiting = waiting.find((player) =>
        isLevelInRange(userRating(player.user), participation.game.minLevel, participation.game.maxLevel)
      );
      if (nextWaiting) {
        await tx.participation.update({
          where: { id: nextWaiting.id },
          data: { status: ParticipationStatus.JOINED }
        });
        promotedWaitingPlayer = true;
      }
    }

    if (wasActive && !promotedWaitingPlayer && participation.game.status === GameStatus.FULL) {
      await tx.game.update({
        where: { id: gameId },
        data: { status: GameStatus.OPEN }
      });
    }

    return participation;
  });
}

export async function createGame(input: {
  title: string;
  startsAt: Date;
  city: string;
  club: string;
  clubId: string;
  address: string;
  courtNumber: string;
  courtPricePerHour: Prisma.Decimal.Value;
  maxPlayers: number;
  pricePerPlayer: Prisma.Decimal.Value;
  minLevel: number;
  maxLevel: number;
  organizerId: string;
}) {
  if (input.startsAt <= appNow()) throw new Error("Match date and time cannot be in the past.");
  return prisma.game.create({ data: { ...input, status: GameStatus.OPEN } });
}

export async function addParticipantToGame(userId: string, gameId: string) {
  return prisma.$transaction(async (tx) => {
    const [game, user] = await Promise.all([
      tx.game.findUnique({
        where: { id: gameId },
        include: { participations: true }
      }),
      tx.user.findUnique({
        where: { id: userId },
        select: withRating({ level: true, deactivatedAt: true })
      })
    ]);

    if (!game) throw new Error("Game not found");
    if (!user) throw new Error("User not found");
    if (user.deactivatedAt) throw new Error("Cannot add a deactivated player");
    if (getEffectiveMatchStatus(game) === GameStatus.EXPIRED) {
      throw new Error("Cannot add players to a closed game");
    }
    if (!isRosterEditable(game.status)) {
      throw new Error("Cannot add players to a closed game");
    }
    if (!isLevelInRange(userRating(user), game.minLevel, game.maxLevel)) {
      throw new Error(levelRangeErrorMessage(userRating(user), game.minLevel, game.maxLevel));
    }
    const existing = game.participations.find((p) => p.userId === userId);
    if (existing && activePlayerStatuses.includes(existing.status)) {
      throw new Error("Player is already in this game");
    }
    if (existing?.status === ParticipationStatus.WAITING) {
      throw new Error("Player is already on the waitlist");
    }

    const activeCount = game.participations.filter((p) => activePlayerStatuses.includes(p.status)).length;
    const nextStatus = activeCount < game.maxPlayers ? ParticipationStatus.JOINED : ParticipationStatus.WAITING;
    const participation = await tx.participation.upsert({
      where: { userId_gameId: { userId, gameId } },
      update: { status: nextStatus, paymentStatus: PaymentStatus.UNPAID },
      create: { userId, gameId, status: nextStatus, paymentStatus: PaymentStatus.UNPAID }
    });

    await syncFullStatus(tx, gameId, { maxPlayers: game.maxPlayers, status: game.status });
    return participation;
  });
}

export async function addGuest(userId: string, gameId: string, name: string | null) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId }, include: { participations: true } });
    if (!game) throw new Error("Game not found");
    if (getEffectiveMatchStatus(game) === GameStatus.EXPIRED || !isRosterEditable(game.status)) {
      throw new Error("Registration is closed for this game");
    }
    const isActiveMember = game.participations.some((p) => p.userId === userId && activePlayerStatuses.includes(p.status));
    if (!isActiveMember) throw new Error("Сначала запишитесь в игру, потом добавляйте гостя");

    const tg = txGuest(tx);
    const myGuests = await tg.count({ where: { gameId, invitedById: userId } });
    if (myGuests >= MAX_GUESTS_PER_MEMBER) throw new Error(`Можно привести не более ${MAX_GUESTS_PER_MEMBER} гостей`);

    const totalGuests = await tg.count({ where: { gameId } });
    const activeCount = game.participations.filter((p) => activePlayerStatuses.includes(p.status)).length + totalGuests;
    if (activeCount >= game.maxPlayers) throw new Error("Нет свободных мест");

    const cleanName = name?.trim() ? name.trim().slice(0, 40) : null;
    const guest = await tg.create({ data: { gameId, invitedById: userId, name: cleanName } });
    await syncFullStatus(tx, gameId, { maxPlayers: game.maxPlayers, status: game.status });
    return guest;
  });
}

export async function removeGuest(guestId: string, user: { id: string; role: string }) {
  return prisma.$transaction(async (tx) => {
    const tg = txGuest(tx);
    const guest = await tg.findUnique({
      where: { id: guestId },
      include: { game: { select: { id: true, organizerId: true, status: true, maxPlayers: true } } }
    });
    if (!guest) throw new Error("Гость не найден");
    const isOrganizerOrAdmin = user.role === UserRole.ADMIN || guest.game.organizerId === user.id;
    if (guest.invitedById !== user.id && !isOrganizerOrAdmin) {
      throw new Error("Удалить гостя может пригласивший или организатор");
    }
    await tg.delete({ where: { id: guestId } });
    await syncFullStatus(tx, guest.game.id, { maxPlayers: guest.game.maxPlayers, status: guest.game.status });
    return guest;
  });
}

export async function setCourtBooked(gameId: string, user: { id: string; role: string }, booked: boolean) {
  let bookedNotify: { title: string; startsAt: Date; city: string; address: string; joined: number; maxPlayers: number } | null = null;
  const result = await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: { participations: { select: { userId: true, status: true } } }
    });
    if (!game) throw new Error("Game not found");
    const wasBooked = (game as { courtBooked?: boolean }).courtBooked === true;

    const isActiveParticipant = game.participations.some(
      (p) => p.userId === user.id && activePlayerStatuses.includes(p.status)
    );
    const isOrganizerOrAdmin = user.role === UserRole.ADMIN || game.organizerId === user.id;
    const currentBookedById = (game as { bookedById?: string | null }).bookedById ?? null;
    // Mark: any joined player / organizer / admin. Unmark: only the person who
    // booked it (or an organizer / admin), so nobody clears someone else's booking.
    const allowed = booked
      ? isOrganizerOrAdmin || isActiveParticipant
      : isOrganizerOrAdmin || currentBookedById === user.id;
    if (!allowed) {
      throw new Error(
        booked
          ? "Only the organizer or a joined player can mark the court as booked"
          : "Only the person who booked it (or an organizer) can unmark it"
      );
    }

    const updated = await tx.game.update({
      where: { id: gameId },
      // courtBooked/bookedBy* are resolved by `prisma generate` on a machine with network access.
      data: { courtBooked: booked, bookedById: booked ? user.id : null, bookedAt: booked ? new Date() : null } as unknown as Prisma.GameUpdateInput
    });
    // Notify the group only on the transition into "booked" (not on unbooking / re-marking).
    if (booked && !wasBooked) {
      const memberActive = game.participations.filter((p) => activePlayerStatuses.includes(p.status)).length;
      const guestCount = await txGuest(tx).count({ where: { gameId } });
      bookedNotify = {
        title: game.title,
        startsAt: game.startsAt,
        city: game.city,
        address: game.address,
        joined: memberActive + guestCount,
        maxPlayers: game.maxPlayers
      };
    }
    return updated;
  });

  if (bookedNotify) {
    const info: { title: string; startsAt: Date; city: string; address: string; joined: number; maxPlayers: number } = bookedNotify;
    try {
      const chatIds = await activeParticipantChatIds(gameId);
      // Personal DM to each participant + one compact group confirmation as a
      // safety net so everyone in the lineup learns the game is on even if their
      // DM channel isn't activated yet.
      await Promise.all([notifyCourtBooked(chatIds, info), notifyCourtBookedGroup(info)]);
    } catch {
      // Notifications must never block the booking toggle.
    }
  }
  return result;
}

export async function deleteGame(gameId: string, admin: GameManager) {
  if (admin.role !== UserRole.ADMIN) throw new Error("Only an admin can delete games");
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: { participations: { select: { userId: true } } }
    });
    if (!game) throw new Error("Game not found");

    const affectedUserIds = Array.from(new Set(game.participations.map((p) => p.userId)));
    await tx.participation.deleteMany({ where: { gameId } });
    await tx.game.delete({ where: { id: gameId } });
    await Promise.all(affectedUserIds.map((userId) => syncUserParticipationMetrics(tx, userId)));
    return game;
  });
}

export async function updateGameStatus(gameId: string, status: GameStatusType, manager: GameManager) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.game.findUnique({
      where: { id: gameId },
      select: { id: true, organizerId: true, status: true, startsAt: true, maxPlayers: true }
    });
    if (!before) throw new Error("Game not found");
    assertCanManageGame(manager, before);
    validateGameStatusTransition({ ...before, status: getEffectiveMatchStatus(before) }, status);

    if (before.status === status) return before;

    const game = await tx.game.update({ where: { id: gameId }, data: { status } });
    if (status === GameStatus.COMPLETED) {
      const joined = await tx.participation.findMany({
        where: { gameId, status: ParticipationStatus.JOINED },
        select: { userId: true }
      });
      await tx.participation.updateMany({
        where: { gameId, status: ParticipationStatus.JOINED },
        data: { status: ParticipationStatus.PLAYED }
      });
      await Promise.all(joined.map((participation) => syncUserParticipationMetrics(tx, participation.userId)));
    }
    if (([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(status)) {
      const synced = await syncFullStatus(tx, gameId, { maxPlayers: before.maxPlayers, status });
      return synced ?? game;
    }
    return game;
  });
}

export async function updateParticipation(
  participationId: string,
  data: { status?: ParticipationStatusType; paymentStatus?: PaymentStatusType },
  manager: GameManager
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.participation.findUnique({
      where: { id: participationId },
      include: {
        game: {
          select: {
            id: true,
            organizerId: true,
            status: true,
            startsAt: true,
            minLevel: true,
            maxLevel: true,
            maxPlayers: true,
            participations: { select: { id: true, status: true } }
          }
        },
        user: { select: withRating({ level: true }) }
      }
    });
    if (!before) throw new Error("Participation not found");
    assertCanManageGame(manager, before.game);
    validateParticipationUpdate({ ...before, game: { ...before.game, status: getEffectiveMatchStatus(before.game) } }, data);

    const updated = await tx.participation.update({ where: { id: participationId }, data });
    if (data.status && data.status !== before.status) await syncUserParticipationMetrics(tx, updated.userId);
    await syncFullStatus(tx, updated.gameId, { maxPlayers: before.game.maxPlayers, status: before.game.status });
    return updated;
  });
}

function validateParticipationUpdate(
  participation: {
    id: string;
    status: string;
    paymentStatus: string;
    user: { level: number };
    game: {
      status: string;
      startsAt: Date;
      minLevel: number;
      maxLevel: number;
      maxPlayers: number;
      participations: { id: string; status: string }[];
    };
  },
  data: { status?: ParticipationStatusType; paymentStatus?: PaymentStatusType }
) {
  if (data.paymentStatus && !paymentEligibleStatuses.includes(participation.status)) {
    throw new Error("Payment can be changed only for joined, played, or no-show players");
  }

  if (!data.status || data.status === participation.status) return;

  if (data.status === ParticipationStatus.JOINED) {
    if (!isRosterEditable(participation.game.status)) throw new Error("Cannot move players into a closed game");
    if (!isLevelInRange(userRating(participation.user), participation.game.minLevel, participation.game.maxLevel)) {
      throw new Error(levelRangeErrorMessage(userRating(participation.user), participation.game.minLevel, participation.game.maxLevel));
    }
    const activeCount = participation.game.participations.filter((player) =>
      player.id !== participation.id && activePlayerStatuses.includes(player.status)
    ).length;
    if (activeCount >= participation.game.maxPlayers) throw new Error("No free spots in this game");
    if (!([ParticipationStatus.WAITING, ParticipationStatus.CANCELLED] as readonly string[]).includes(participation.status)) {
      throw new Error("Only waiting or cancelled players can be moved into the roster");
    }
  }

  if (data.status === ParticipationStatus.WAITING) {
    if (!isRosterEditable(participation.game.status)) throw new Error("Cannot move players to waitlist in a closed game");
    if (participation.status !== ParticipationStatus.JOINED) {
      throw new Error("Only joined players can be moved to waitlist");
    }
  }

  if (data.status === ParticipationStatus.NO_SHOW) {
    if (!isAttendanceEditable(participation.game)) throw new Error("No-show can be marked only after the game starts");
    if (!([ParticipationStatus.JOINED, ParticipationStatus.PLAYED] as readonly string[]).includes(participation.status)) {
      throw new Error("Only joined or played players can be marked as no-show");
    }
  }

  if (data.status === ParticipationStatus.PLAYED) {
    if (!isAttendanceEditable(participation.game)) throw new Error("Attendance can be marked only after the game starts");
    if (!([ParticipationStatus.JOINED, ParticipationStatus.NO_SHOW] as readonly string[]).includes(participation.status)) {
      throw new Error("Only joined or no-show players can be marked as played");
    }
  }
}

async function syncUserParticipationMetrics(tx: Prisma.TransactionClient, userId: string) {
  const [gamesCount, noShows] = await Promise.all([
    tx.participation.count({ where: { userId, status: ParticipationStatus.PLAYED } }),
    tx.participation.count({ where: { userId, status: ParticipationStatus.NO_SHOW } })
  ]);
  await tx.user.update({
    where: { id: userId },
    data: { gamesCount, noShows }
  });
}

async function syncFullStatus(
  tx: Prisma.TransactionClient,
  gameId: string,
  known?: { maxPlayers: number; status: string }
) {
  const game = known ?? await tx.game.findUnique({
    where: { id: gameId },
    select: { maxPlayers: true, status: true }
  });
  if (!game || ([GameStatus.CANCELLED, GameStatus.COMPLETED, GameStatus.DRAFT, GameStatus.EXPIRED] as readonly string[]).includes(game.status)) return null;

  const [players, guestCount] = await Promise.all([
    tx.participation.count({ where: { gameId, status: { in: [...activePlayerStatuses] } } }),
    txGuest(tx).count({ where: { gameId } })
  ]);
  const count = players + guestCount;
  return tx.game.update({
    where: { id: gameId },
    data: { status: count >= game.maxPlayers ? GameStatus.FULL : GameStatus.OPEN }
  });
}

export async function expirePastUnfinishedGames(now = appNow()) {
  return prisma.game.updateMany({
    where: {
      startsAt: { lte: now },
      status: { in: [GameStatus.OPEN, GameStatus.FULL] }
    },
    data: { status: GameStatus.EXPIRED }
  });
}

function isTransactionWriteConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
