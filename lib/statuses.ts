export const UserRole = {
  PLAYER: "PLAYER",
  ORGANIZER: "ORGANIZER",
  ADMIN: "ADMIN"
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const GameStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  FULL: "FULL",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  EXPIRED: "EXPIRED"
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export const gameStatusLabels: Record<GameStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  FULL: "Full",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

export type GameStatusLabels = (typeof gameStatusLabels)[GameStatus];

export const ParticipationStatus = {
  REQUESTED: "REQUESTED",
  JOINED: "JOINED",
  WAITING: "WAITING",
  CANCELLED: "CANCELLED",
  PLAYED: "PLAYED",
  NO_SHOW: "NO_SHOW"
} as const;

export type ParticipationStatus = (typeof ParticipationStatus)[keyof typeof ParticipationStatus];

export const participationStatusLabels: Record<ParticipationStatus, string> = {
  REQUESTED: "Requested",
  JOINED: "Joined",
  WAITING: "Waiting List",
  CANCELLED: "Cancelled",
  PLAYED: "Played",
  NO_SHOW: "No-show",
};

export type ParticipationsStatusLabels = (typeof participationStatusLabels)[ParticipationStatus];

export const PaymentStatus = {
  PAID: "PAID",
  UNPAID: "UNPAID"
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
};

export type PaymentStatusLabels = (typeof paymentStatusLabels)[PaymentStatus];

export const TournamentStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED"
} as const;

export type TournamentStatus = (typeof TournamentStatus)[keyof typeof TournamentStatus];

export const tournamentStatusLabels: Record<TournamentStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export type TournamentStatusLabels = (typeof tournamentStatusLabels)[TournamentStatus];

export const TournamentParticipantStatus = {
  JOINED: "JOINED",
  WAITING: "WAITING",
  REMOVED: "REMOVED"
} as const;

export type TournamentParticipantStatus = (typeof TournamentParticipantStatus)[keyof typeof TournamentParticipantStatus];

export const tournamentParticipantStatusLabels: Record<TournamentParticipantStatus, string> = {
  JOINED: "Registered",
  WAITING: "Waiting List",
  REMOVED: "Removed",
};

export type TournamentParticipantStatusLabels = (typeof tournamentParticipantStatusLabels)[TournamentParticipantStatus];
