import Link from "next/link";
import { Prisma } from "@prisma/client";
import { joinGameAction } from "@/app/actions";
import { LocationMaps } from "@/components/location-maps";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { getEffectiveMatchStatus, getMatchActionState, type MatchAction, type MatchBadge } from "@/lib/action-states";
import { formatLevelRange, isLevelInRange, levelMismatchMessage } from "@/lib/levels";
import { formatMoney } from "@/lib/pricing";
import { ParticipationStatus } from "@/lib/statuses";
import { translate, translateLabel, type Lang } from "@/lib/dictionaries";
import { cityLabel } from "@/lib/cities";
import { getLang } from "@/lib/server-i18n";

type GameCardProps = {
  game: {
    id: string;
    title: string;
    startsAt: Date;
    city: string;
    club: string;
    address: string;
    maxPlayers: number;
    pricePerPlayer: Prisma.Decimal.Value;
    minLevel: number;
    maxLevel: number;
    organizerId: string;
    status: string;
    courtBooked?: boolean;
    guestCount?: number;
    participations: { userId: string; status: string }[];
  };
  currentUserId?: string;
  currentUserRole?: string;
  userLevel?: number;
};

export function GameCard({ game, currentUserId, currentUserRole, userLevel }: GameCardProps) {
  const joined = game.participations.filter((p) =>
    ([ParticipationStatus.JOINED, ParticipationStatus.PLAYED, ParticipationStatus.NO_SHOW] as readonly string[]).includes(p.status)
  ).length + (game.guestCount ?? 0);
  const currentParticipation = currentUserId ? game.participations.find((p) => p.userId === currentUserId) : null;
  const levelMatches = userLevel === undefined || isLevelInRange(userLevel, game.minLevel, game.maxLevel);
  const levelError = userLevel !== undefined && !levelMatches ? levelMismatchMessage(userLevel, game.minLevel, game.maxLevel) : null;
  const actionState = getMatchActionState({
    currentParticipationStatus: currentParticipation?.status,
    currentUserId,
    gameId: game.id,
    gameStatus: game.status,
    isLoggedIn: Boolean(currentUserId),
    organizerId: game.organizerId,
    startsAt: game.startsAt,
    userRole: currentUserRole
  });
  const effectiveStatus = getEffectiveMatchStatus(game);
  const lang = getLang();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  return (
    <article className="epci-card-compact group" data-testid={`game-card-${game.title}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-court">
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(game.startsAt)} ·{" "}
            {new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(game.startsAt)}
          </p>
          <h2 className="mt-2 text-xl font-black text-ink transition group-hover:text-court">
            <Link href={`/games/${game.id}`} className="hover:underline" data-testid={`game-title-${game.title}`}>{game.title}</Link>
          </h2>
          <LocationMaps city={cityLabel(game.city, lang) || game.city} address={game.address} className="mt-1" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge type="game" status={effectiveStatus} testId={statusTestId(effectiveStatus)} lang={lang} />
          {game.courtBooked ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-court/20 bg-court-soft px-2 py-0.5 text-[0.65rem] font-black text-court">✅ {t("court.chip")}</span>
          ) : null}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <div className="epci-mini-surface px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t("game.level")}</p>
          <p className="mt-1 font-black text-ink">{formatLevelRange(game.minLevel, game.maxLevel)}</p>
        </div>
        <div className="epci-mini-surface px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t("game.players")}</p>
          <p className="mt-1 font-black text-ink" data-testid="joined-count">
            {joined}/{game.maxPlayers}
          </p>
        </div>
        <div className="epci-mini-surface px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t("game.price")}</p>
          <p className="mt-1 font-black text-ink">₪{formatMoney(game.pricePerPlayer)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <MatchBadges badges={actionState.badges} lang={lang} />
        <div className="flex min-w-full flex-1 gap-2">
          {actionState.actions.map((action) => (
            <GameAction key={`${action.kind}-${action.label}`} action={action} gameId={game.id} testId={`join-${game.title}`} disabled={action.kind === "join" && !levelMatches} lang={lang} />
          ))}
        </div>
      </div>
      {actionState.actions.some((action) => action.kind === "join") && levelError ? <LevelMismatchWarning message={levelError} title={t("game.mismatch_title")} /> : null}
    </article>
  );
}

function LevelMismatchWarning({ message, title }: { message: string; title: string }) {
  return (
    <div className="epci-alert-warning mt-3 px-3 py-2" data-testid="level-mismatch-warning">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-amber-800">{message}</p>
    </div>
  );
}

function statusTestId(status: string) {
  if (status === "COMPLETED") return "match-badge-Completed";
  if (status === "CANCELLED") return "match-badge-Cancelled";
  if (status === "EXPIRED") return "match-badge-Expired";
  if (status === "FULL") return "match-badge-Full";
  return "game-status";
}

function MatchBadges({ badges, lang }: { badges: MatchBadge[]; lang: Lang }) {
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-black leading-4 shadow-sm ${
            badge.tone === "success"
              ? "border-court/20 bg-court-soft text-court"
              : badge.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-line bg-white text-ink/60"
          }`}
          data-testid={`match-badge-${badge.label}`}
        >
          {translateLabel(lang, badge.label)}
        </span>
      ))}
    </div>
  );
}

function GameAction({ action, disabled = false, gameId, testId, lang }: { action: MatchAction; disabled?: boolean; gameId: string; testId: string; lang: Lang }) {
  if (action.kind === "link") {
    return (
      <Link className="epci-btn-secondary flex-1 px-3 py-2" href={action.href ?? "#"} data-testid={action.label === "View Details" ? `details-${gameId}` : testId}>
        {translateLabel(lang, action.label)}
      </Link>
    );
  }
  return (
    <form action={joinGameAction} className="flex-1">
      <input type="hidden" name="gameId" value={gameId} />
      <SubmitButton
        className="epci-btn-primary w-full px-3 py-2 disabled:cursor-not-allowed"
        disabled={disabled}
        label={translateLabel(lang, action.label)}
        testId={testId}
      />
    </form>
  );
}
