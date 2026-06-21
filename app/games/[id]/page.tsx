import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { joinGameAction, leaveGameAction, toggleCourtBookedAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { LazuzButton } from "@/components/lazuz-button";
import { PlayerAvatar } from "@/components/player-avatar";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { getEffectiveMatchStatus, getMatchActionState, type MatchAction, type MatchBadge } from "@/lib/action-states";
import { getCurrentUser } from "@/lib/auth";
import { effectiveRating, formatLevelRange, isLevelInRange, levelMismatchMessage } from "@/lib/levels";
import { getGame, joinedCount } from "@/lib/games";
import { JoinedRoster } from "@/components/joined-roster";
import { RankedMatchPanel } from "@/components/ranked-match-panel";
import { getMatchState, previewMatchRatings } from "@/lib/ranked";
import { appNow } from "@/lib/app-time";
import { formatMoney } from "@/lib/pricing";
import { ParticipationStatus } from "@/lib/statuses";
import { translate, translateLabel, type Lang } from "@/lib/dictionaries";
import { cityLabel } from "@/lib/cities";
import { LocationMaps } from "@/components/location-maps";
import type { Metadata } from "next";
import { getLang } from "@/lib/server-i18n";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const game = await prisma.game.findUnique({ where: { id: params.id }, select: { title: true } });
  return { title: game?.title ?? (getLang() === "ru" ? "Игра" : "Game") };
}

export default async function GamePage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; joined?: string; left?: string } }) {
  const [game, user] = await Promise.all([getGame(params.id), getCurrentUser()]);
  if (!user) redirect("/login");
  if (!game) notFound();

  const joined = game.participations.filter((p) => p.status === ParticipationStatus.JOINED || p.status === ParticipationStatus.PLAYED || p.status === ParticipationStatus.NO_SHOW);
  const waiting = game.participations.filter((p) => p.status === ParticipationStatus.WAITING);
  const totalJoined = joinedCount(game);
  const canManageGame = user.role === "ADMIN" || game.organizerId === user.id;
  const slotsLeft = Math.max(0, game.maxPlayers - totalJoined);
  const myParticipation = user ? game.participations.find((p) => p.userId === user.id) : null;
  const userRating = user ? effectiveRating(user as { skillRating?: number | null; level: number }) : 0;
  const levelMatches = user ? isLevelInRange(userRating, game.minLevel, game.maxLevel) : false;
  const levelError = user && !levelMatches ? levelMismatchMessage(userRating, game.minLevel, game.maxLevel) : null;
  const actionState = getMatchActionState({
    currentParticipationStatus: myParticipation?.status,
    currentUserId: user?.id,
    gameId: game.id,
    gameStatus: game.status,
    isLoggedIn: Boolean(user),
    organizerId: game.organizerId,
    startsAt: game.startsAt,
    userRole: user?.role
  });
  const effectiveStatus = getEffectiveMatchStatus(game);
  const detailActions = actionState.actions.filter((action) => action.label !== "View Details");
  const lang = getLang();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const successMessage = searchParams.joined ? t("game.joined_ok") : searchParams.left ? t("game.left_ok") : null;

  const booked = Boolean((game as { courtBooked?: boolean }).courtBooked);
  const bookedById = (game as { bookedById?: string | null }).bookedById ?? null;
  const activeStatuses: string[] = [ParticipationStatus.JOINED, ParticipationStatus.PLAYED, ParticipationStatus.NO_SHOW];
  const isActiveParticipant = Boolean(user && game.participations.some((p) => p.userId === user.id && activeStatuses.includes(p.status)));
  const canToggleBooking = Boolean(user && (user.role === "ADMIN" || game.organizerId === user.id || isActiveParticipant));
  const canUnbook = Boolean(user && (user.role === "ADMIN" || game.organizerId === user.id || bookedById === user.id));
  const booker = bookedById ? game.participations.find((p) => p.userId === bookedById)?.user : null;
  const bookedByName = booker ? `${booker.name} ${booker.lastName}` : game.organizer.id === bookedById ? game.organizer.name : null;

  const matchState = await getMatchState(game.id);
  const matchPreview = matchState.ranked && !matchState.appliedAt ? await previewMatchRatings(game.id) : null;
  const rankedParticipants = joined.map((p) => ({ id: p.userId, name: p.user.name, lastName: p.user.lastName, photoUrl: p.user.photoUrl }));
  const gameStarted = game.startsAt <= appNow();

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="epci-card">
        <StatusBadge type="game" status={effectiveStatus} testId={statusTestId(effectiveStatus)} lang={lang} />
        <h1 className="epci-page-title mt-2">{game.title}</h1>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <Info label={t("game.date")} value={new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { dateStyle: "full", timeStyle: "short" }).format(game.startsAt)} />
          <Info label={t("game.city")} value={cityLabel(game.city, lang) || game.city} />
          <Info label={t("game.club")} value={game.club} />
          <Info label={t("game.address")} value={game.address} />
          <Info label={t("game.court")} value={game.courtNumber} />
          <Info label={t("game.slots")} value={`${totalJoined}/${game.maxPlayers}`} />
          <Info label={t("game.price")} value={`₪${formatMoney(game.pricePerPlayer)}`} />
          <Info label={t("game.levels")} value={formatLevelRange(game.minLevel, game.maxLevel)} />
          <Info label={t("game.organizer")} value={game.organizer.name} />
        </dl>
        <LocationMaps city={cityLabel(game.city, lang) || game.city} address={game.address} className="mt-4" />
        <div className="mt-5 space-y-3">
          <MatchBadges badges={actionState.badges} lang={lang} />
          <div className="flex flex-wrap gap-2">
            {detailActions.map((action) => (
              <GameAction key={`${action.kind}-${action.label}`} action={action} gameId={game.id} disabled={action.kind === "join" && !levelMatches} lang={lang} />
            ))}
            {user && actionState.canLeave ? (
              <form action={leaveGameAction} className="min-w-36 flex-1">
                <input type="hidden" name="gameId" value={game.id} />
                <input type="hidden" name="redirectTo" value={`/games/${game.id}`} />
                <ConfirmSubmitButton
                  className="epci-btn-secondary w-full"
                  confirmMessage={t("game.leave_confirm")}
                  label={t("game.leave")}
                  testId="game-leave-button"
                />
              </form>
            ) : null}
          </div>
          <div className="space-y-2 border-t border-line/80 pt-3">
            {booked ? (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-court/25 bg-court-soft px-3 py-2 text-sm font-black text-court" data-testid="court-booked">
                  <span aria-hidden="true">✅</span>
                  <span>{t("court.booked")}{bookedByName ? ` · ${bookedByName}` : ""}</span>
                </div>
                <LazuzButton className="epci-btn-secondary w-full" />
                {canUnbook ? (
                  <form action={toggleCourtBookedAction}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <input type="hidden" name="booked" value="false" />
                    <SubmitButton className="epci-btn-ghost w-full text-sm" label={t("court.unmark")} testId="court-unmark" />
                  </form>
                ) : null}
              </>
            ) : (
              <>
                <LazuzButton />
                {canToggleBooking ? (
                  <form action={toggleCourtBookedAction}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <input type="hidden" name="booked" value="true" />
                    <SubmitButton className="epci-btn-secondary w-full" label={t("court.mark")} testId="court-mark" />
                  </form>
                ) : null}
              </>
            )}
          </div>
        </div>
        {searchParams.error ? <p className="epci-alert-error mt-3" data-testid="game-error">{searchParams.error}</p> : null}
        {successMessage ? <p className="epci-alert-success mt-3" data-testid="game-success">{successMessage}</p> : null}
        {!searchParams.error && actionState.actions.some((action) => action.kind === "join") && levelError ? <LevelMismatchWarning message={levelError} title={t("game.mismatch_title")} /> : null}
      </section>

      <section className="space-y-4">
        <JoinedRoster
          gameId={game.id}
          title={t("game.players_list")}
          emptyMessage={t("game.no_players")}
          noCity={t("game.no_city")}
          participants={joined}
          guests={game.guests}
          currentUserId={user.id}
          canManage={canManageGame}
          slotsLeft={slotsLeft}
          lang={lang}
        />
        {matchState.ranked || canManageGame ? (
          <RankedMatchPanel
            gameId={game.id}
            isManager={canManageGame}
            isAdmin={user.role === "ADMIN"}
            redirectTo={`/games/${game.id}`}
            currentUserId={user.id}
            started={gameStarted}
            participants={rankedParticipants}
            ranked={matchState.ranked}
            appliedAt={matchState.appliedAt ? new Date(matchState.appliedAt).toISOString() : null}
            rounds={matchState.rounds.map((r: { idx: number; aPlayer1: string; aPlayer2: string; bPlayer1: string; bPlayer2: string; scoreA: number; scoreB: number }) => ({ idx: r.idx, aPlayer1: r.aPlayer1, aPlayer2: r.aPlayer2, bPlayer1: r.bPlayer1, bPlayer2: r.bPlayer2, scoreA: r.scoreA, scoreB: r.scoreB }))}
            confirmations={matchState.confirmations.map((c: { userId: string }) => ({ userId: c.userId }))}
            changes={matchState.changes.map((c: { userId: string; before: number; after: number; delta: number }) => ({ userId: c.userId, before: c.before, after: c.after, delta: c.delta }))}
            preview={matchPreview ? Object.values(matchPreview.changes).map((c) => ({ userId: c.userId, before: c.before, after: c.after, delta: c.delta })) : null}
            lang={lang}
          />
        ) : null}
        <Roster title={t("game.waitlist")} people={waiting} testId="waiting-list" emptyMessage={t("game.no_waitlist")} noCity={t("game.no_city")} lang={lang} />
      </section>
    </div>
  );
}

function LevelMismatchWarning({ message, title }: { message: string; title: string }) {
  return (
    <div className="epci-alert-warning mt-3" data-testid="level-mismatch-warning">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 leading-6 text-amber-800">{message}</p>
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

function GameAction({ action, disabled = false, gameId, lang }: { action: MatchAction; disabled?: boolean; gameId: string; lang: Lang }) {
  if (action.kind === "link") {
    return (
      <Link className="epci-btn-secondary min-w-36 flex-1" href={action.href ?? "#"} data-testid="game-action-link">
        {translateLabel(lang, action.label)}
      </Link>
    );
  }
  return (
    <form action={joinGameAction} className="min-w-36 flex-1">
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="redirectTo" value={`/games/${gameId}`} />
      <SubmitButton
        className="epci-btn-primary w-full"
        disabled={disabled}
        label={translateLabel(lang, action.label)}
        testId="game-join-button"
      />
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{label}</dt>
      <dd className="mt-1 font-black text-ink">{value}</dd>
    </div>
  );
}

function Roster({ title, people, testId, emptyMessage, noCity, lang }: { title: string; people: { id: string; status: string; user: { name: string; lastName: string; photoUrl: string | null; level: number; city: string | null } }[]; testId: string; emptyMessage: string; noCity: string; lang: Lang }) {
  return (
    <div className="epci-card">
      <h2 className="font-black">{title}</h2>
      <div className="mt-3 space-y-2" data-testid={testId}>
        {people.length ? people.map((p) => (
          <div key={p.id} className="epci-mini-surface flex items-center gap-3 px-3 py-2 text-sm" data-testid={`${testId}-player-${p.user.name}`}>
            <PlayerAvatar photoUrl={p.user.photoUrl} name={p.user.name} lastName={p.user.lastName} size="sm" />
            <span>{p.user.name} {p.user.lastName} · {p.user.level.toFixed(1)} · {cityLabel(p.user.city, lang) || noCity}</span>
          </div>
        )) : <EmptyState message={emptyMessage} className="min-h-20" />}
      </div>
    </div>
  );
}
