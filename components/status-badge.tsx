import {
  GameStatus,
  type GameStatus as GameStatusType,
  PaymentStatus,
  type PaymentStatus as PaymentStatusType,
  ParticipationStatus,
  type ParticipationStatus as ParticipationStatusType,
  TournamentParticipantStatus,
  type TournamentParticipantStatus as TournamentParticipantStatusType,
  TournamentStatus,
  type TournamentStatus as TournamentStatusType,
  gameStatusLabels,
  participationStatusLabels,
  paymentStatusLabels,
  tournamentParticipantStatusLabels,
  tournamentStatusLabels
} from "@/lib/statuses";
import { translate, type DictKey, type Lang } from "@/lib/dictionaries";

type StatusBadgeProps =
  | { type: "game"; status: GameStatusType | string; testId?: string; lang?: Lang }
  | { type: "tournament"; status: TournamentStatusType | string; testId?: string; lang?: Lang }
  | { type: "participation"; status: ParticipationStatusType | string; testId?: string; lang?: Lang }
  | { type: "payment"; status: PaymentStatusType | string; testId?: string; lang?: Lang }
  | { type: "tournamentParticipant"; status: TournamentParticipantStatusType | string; testId?: string; lang?: Lang };

// Member-facing statuses get localized; admin-only ones keep their English label.
const gameStatusKeys: Record<string, DictKey> = {
  OPEN: "st.open",
  FULL: "st.full",
  COMPLETED: "st.completed",
  CANCELLED: "st.cancelled",
  EXPIRED: "st.expired",
  DRAFT: "st.draft"
};
const paymentStatusKeys: Record<string, DictKey> = {
  PAID: "st.paid",
  UNPAID: "st.unpaid"
};
const participationKeys: Record<string, DictKey> = {
  REQUESTED: "part.requested",
  JOINED: "part.joined",
  WAITING: "part.waiting",
  CANCELLED: "part.cancelled",
  PLAYED: "part.played",
  NO_SHOW: "part.noshow"
};
const tournamentParticipantKeys: Record<string, DictKey> = {
  JOINED: "part.registered",
  WAITING: "part.waiting",
  REMOVED: "part.removed"
};

const badgeStyles: Record<string, string> = {
  green: "border-court/20 bg-court-soft text-court",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  gray: "border-line bg-white text-ink/60"
};

export function StatusBadge({ type, status, testId, lang }: StatusBadgeProps) {
  const label = statusLabel(type, status, lang);
  const tone = statusTone(status);

  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black leading-4 shadow-sm ${badgeStyles[tone]}`} data-testid={testId}>
      {label}
    </span>
  );
}

function statusLabel(type: StatusBadgeProps["type"], status: string, lang?: Lang) {
  if (lang && (type === "game" || type === "tournament") && gameStatusKeys[status]) return translate(lang, gameStatusKeys[status]);
  if (lang && type === "payment" && paymentStatusKeys[status]) return translate(lang, paymentStatusKeys[status]);
  if (lang && type === "participation" && participationKeys[status]) return translate(lang, participationKeys[status]);
  if (lang && type === "tournamentParticipant" && tournamentParticipantKeys[status]) return translate(lang, tournamentParticipantKeys[status]);
  if (type === "game") return gameStatusLabels[status as GameStatusType] ?? fallbackLabel(status);
  if (type === "tournament") return tournamentStatusLabels[status as TournamentStatusType] ?? fallbackLabel(status);
  if (type === "participation") return participationStatusLabels[status as ParticipationStatusType] ?? fallbackLabel(status);
  if (type === "payment") return paymentStatusLabels[status as PaymentStatusType] ?? fallbackLabel(status);
  return tournamentParticipantStatusLabels[status as TournamentParticipantStatusType] ?? fallbackLabel(status);
}

function statusTone(status: string) {
  if (status === GameStatus.OPEN || status === TournamentStatus.OPEN || status === PaymentStatus.PAID || status === ParticipationStatus.JOINED || status === TournamentParticipantStatus.JOINED) return "green";
  if (status === GameStatus.COMPLETED || status === TournamentStatus.COMPLETED || status === ParticipationStatus.PLAYED) return "blue";
  if (status === GameStatus.FULL || status === ParticipationStatus.WAITING || status === PaymentStatus.UNPAID || status === TournamentParticipantStatus.WAITING || status === ParticipationStatus.REQUESTED) return "amber";
  if (status === GameStatus.CANCELLED || status === GameStatus.EXPIRED || status === TournamentStatus.CANCELLED || status === ParticipationStatus.CANCELLED || status === ParticipationStatus.NO_SHOW || status === TournamentParticipantStatus.REMOVED) return "red";
  return "gray";
}

function fallbackLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
