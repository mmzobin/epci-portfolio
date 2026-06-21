import { GameStatus, ParticipationStatus, TournamentParticipantStatus, TournamentStatus, UserRole } from "@/lib/statuses";
import { appNow } from "@/lib/app-time";

export type ActionState =
  | { kind: "none" }
  | { kind: "submit"; label: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "disabled"; label: string };

export type MatchAction = {
  href?: string;
  kind: "join" | "link";
  label: string;
};

export type MatchBadge = {
  label: string;
  tone: "neutral" | "success" | "warning";
};

export type MatchActionState = {
  badges: MatchBadge[];
  actions: MatchAction[];
  canLeave: boolean;
  userStatus: "host" | "joined" | "not-joined";
};

type MatchActionInput = {
  currentParticipationStatus?: string | null;
  currentUserId?: string | null;
  gameId: string;
  gameStatus: string;
  isLoggedIn: boolean;
  organizerId: string;
  startsAt?: Date | null;
  userRole?: string | null;
};

type TournamentActionInput = {
  currentParticipationStatus?: string | null;
  isLoggedIn: boolean;
  resultsHref?: string;
  tournamentStatus: string;
};

const activeGameParticipationStatuses: readonly string[] = [
  ParticipationStatus.JOINED,
  ParticipationStatus.PLAYED,
  ParticipationStatus.NO_SHOW
];

const joinedGameParticipationStatuses: readonly string[] = [
  ...activeGameParticipationStatuses,
  ParticipationStatus.WAITING
];

export function getMatchActionState({
  currentParticipationStatus,
  currentUserId,
  gameId,
  gameStatus,
  isLoggedIn,
  organizerId,
  startsAt,
  userRole
}: MatchActionInput): MatchActionState {
  const effectiveStatus = getEffectiveMatchStatus({ status: gameStatus, startsAt });
  const isHost = Boolean(currentUserId && currentUserId === organizerId);
  const canManage = isHost || userRole === UserRole.ADMIN;
  const isJoined = Boolean(currentParticipationStatus && joinedGameParticipationStatuses.includes(currentParticipationStatus));
  const badges: MatchBadge[] = [];
  const actions: MatchAction[] = [{ kind: "link", label: "View Details", href: `/games/${gameId}` }];

  if (effectiveStatus === GameStatus.COMPLETED) {
    return { badges, actions, canLeave: false, userStatus: isHost ? "host" : isJoined ? "joined" : "not-joined" };
  }

  if (effectiveStatus === GameStatus.EXPIRED) {
    return { badges, actions, canLeave: false, userStatus: isHost ? "host" : isJoined ? "joined" : "not-joined" };
  }

  if (effectiveStatus === GameStatus.CANCELLED) {
    return { badges, actions, canLeave: false, userStatus: isHost ? "host" : isJoined ? "joined" : "not-joined" };
  }

  if (canManage) {
    if (isHost) badges.push({ label: "Host", tone: "warning" });
    if (([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(effectiveStatus)) {
      actions.push({ kind: "link", label: "Manage Match", href: `/organizer/games/${gameId}` });
    }
  }

  if (isJoined) {
    badges.push({ label: currentParticipationStatus === ParticipationStatus.WAITING ? "On Waitlist" : "Joined", tone: "success" });
    return {
      badges,
      actions,
      canLeave: ([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(effectiveStatus),
      userStatus: "joined"
    };
  }

  if (effectiveStatus === GameStatus.FULL) {
    if (isLoggedIn) {
      actions.unshift({ kind: "join", label: "Join Waitlist" });
      return { badges, actions, canLeave: false, userStatus: "not-joined" };
    }
    return { badges, actions, canLeave: false, userStatus: "not-joined" };
  }

  if (effectiveStatus === GameStatus.OPEN) {
    actions.unshift(
      isLoggedIn
        ? { kind: "join", label: "Join Match" }
        : { kind: "link", label: "Log in to Join", href: "/login" }
    );
  }

  return { badges, actions, canLeave: false, userStatus: "not-joined" };
}

export function getEffectiveMatchStatus(game: { status: string; startsAt?: Date | null }, now = appNow()) {
  if (
    game.startsAt &&
    game.startsAt <= now &&
    ([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(game.status)
  ) {
    return GameStatus.EXPIRED;
  }

  return game.status;
}

export function getTournamentActionState({
  currentParticipationStatus,
  isLoggedIn,
  resultsHref,
  tournamentStatus
}: TournamentActionInput): ActionState {
  if (tournamentStatus === TournamentStatus.DRAFT) return { kind: "none" };
  if (tournamentStatus === TournamentStatus.CANCELLED) return { kind: "disabled", label: "Tournament Cancelled" };
  if (tournamentStatus === TournamentStatus.COMPLETED) {
    return resultsHref
      ? { kind: "link", label: "View Results", href: resultsHref }
      : { kind: "disabled", label: "Completed" };
  }

  if (currentParticipationStatus === TournamentParticipantStatus.WAITING) {
    return { kind: "disabled", label: "On Waitlist" };
  }
  if (currentParticipationStatus === TournamentParticipantStatus.JOINED) {
    return { kind: "disabled", label: "Registered" };
  }

  if (!isLoggedIn) return { kind: "link", label: "Log in to Join", href: "/login" };

  if (tournamentStatus === TournamentStatus.OPEN) {
    return { kind: "submit", label: "Join Tournament" };
  }

  return { kind: "none" };
}
