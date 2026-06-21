import { notFound } from "next/navigation";
import { addParticipantsAction, deleteGameAction, participationAction, setGameStatusAction, updateGameAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { GameForm } from "@/components/game-form";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerMultiSelect } from "@/components/player-multi-select";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganizer } from "@/lib/auth";
import { getManageableGame, joinedCount } from "@/lib/games";
import { getMatchState, previewMatchRatings } from "@/lib/ranked";
import { RankedMatchPanel } from "@/components/ranked-match-panel";
import { appNow } from "@/lib/app-time";
import { HIDDEN_USER_FILTER } from "@/lib/users";
import { effectiveRating, formatLevelRange, isLevelInRange } from "@/lib/levels";
import { formatMoney } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { GameStatus, type GameStatus as GameStatusType, ParticipationStatus, UserRole } from "@/lib/statuses";

import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { lang } = getT();
  const game = await prisma.game.findUnique({ where: { id: params.id }, select: { title: true } });
  return { title: game?.title ?? (lang === "ru" ? "Управление игрой" : "Manage game") };
}

export default async function OrganizerGamePage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string; saved?: string } }) {
  const currentUser = await requireOrganizer();
  const game = await getManageableGame(params.id, currentUser);
  if (!game) notFound();
  const now = appNow();
  const attendanceCanBeMarked = game.status === GameStatus.COMPLETED || game.startsAt <= now;
  const rosterCanBeChanged = !([GameStatus.CANCELLED, GameStatus.COMPLETED, GameStatus.DRAFT] as readonly string[]).includes(game.status);
  const statusCanBeChanged = ([GameStatus.OPEN, GameStatus.FULL] as readonly string[]).includes(game.status);
  const canCancel = statusCanBeChanged;
  // Expired games (started while still open/full) can be completed: the organizer
  // records the result after the match was actually played.
  const canComplete =
    ([GameStatus.OPEN, GameStatus.FULL, GameStatus.EXPIRED] as readonly string[]).includes(game.status) &&
    game.startsAt <= now;
  const canOpen = game.status === GameStatus.DRAFT || (game.status === GameStatus.CANCELLED && game.startsAt > now);
  const clubs = await prisma.club.findMany({
    where: {
      OR: [
        { deletedAt: null },
        game.clubId ? { id: game.clubId } : { id: "" }
      ]
    },
    orderBy: [{ city: "asc" }, { name: "asc" }]
  });
  const participantUserIds = new Set(game.participations.map((participation) => participation.userId));
  const users = await prisma.user.findMany({
    where: { id: { notIn: Array.from(participantUserIds) }, deactivatedAt: null, ...HIDDEN_USER_FILTER },
    orderBy: [{ name: "asc" }, { lastName: "asc" }],
    select: { id: true, name: true, lastName: true, level: true, email: true, skillRating: true } as unknown as { id: true; name: true; lastName: true; level: true; email: true }
  });
  const eligibleUsers = users.filter((user) => isLevelInRange(effectiveRating(user as { skillRating?: number | null; level: number }), game.minLevel, game.maxLevel));

  const { lang } = getT();
  const matchState = await getMatchState(game.id);
  const matchPreview = matchState.ranked && !matchState.appliedAt ? await previewMatchRatings(game.id) : null;
  const activeStatuses: string[] = [ParticipationStatus.JOINED, ParticipationStatus.PLAYED, ParticipationStatus.NO_SHOW];
  const rankedParticipants = game.participations
    .filter((p) => activeStatuses.includes(p.status))
    .map((p) => ({ id: p.userId, name: p.user.name, lastName: p.user.lastName, photoUrl: p.user.photoUrl }));
  const gameStarted = game.startsAt <= new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="epci-page-title">{game.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-ink/55">
            <span>Status:</span>
            <StatusBadge type="game" status={game.status} testId={statusTestId(game.status)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusButton gameId={game.id} status={GameStatus.CANCELLED} label="Cancel" testId="cancel-game" confirmMessage="Cancel game?" disabled={!canCancel} />
          <StatusButton gameId={game.id} status={GameStatus.COMPLETED} label="Complete" testId="complete-game" confirmMessage="Complete game and mark current participants as played?" disabled={!canComplete} />
          <StatusButton gameId={game.id} status={GameStatus.OPEN} label="Open" testId="open-game" confirmMessage="Open game for registration?" disabled={!canOpen} />
          {currentUser.role === UserRole.ADMIN ? (
            <form action={deleteGameAction}>
              <input type="hidden" name="gameId" value={game.id} />
              <ConfirmSubmitButton
                className="epci-btn-danger px-3 py-2"
                confirmMessage={game.status === GameStatus.COMPLETED
                  ? `Delete completed game "${game.title}"? This will permanently remove its participants and their played stats from this game.`
                  : `Delete game "${game.title}"? This will permanently remove the game and its participants.`}
                label="Delete"
                testId="delete-game"
              />
            </form>
          ) : null}
        </div>
      </div>

      <GameForm
        action={updateGameAction}
        game={{
          id: game.id,
          title: game.title,
          startsAt: game.startsAt,
          city: game.city,
          club: game.club,
          clubId: game.clubId,
          address: game.address,
          courtNumber: game.courtNumber,
          courtPricePerHour: formatMoney(game.courtPricePerHour),
          maxPlayers: game.maxPlayers,
          pricePerPlayer: formatMoney(game.pricePerPlayer),
          minLevel: game.minLevel,
          maxLevel: game.maxLevel
        }}
        clubs={clubs.map((club) => ({
          id: club.id,
          name: club.name,
          city: club.city,
          address: club.address,
          hourlyCourtPrice: formatMoney(club.hourlyCourtPrice)
        }))}
      />
      {searchParams.error ? <p className="epci-alert-error" data-testid="organizer-game-error">{searchParams.error}</p> : null}
      {searchParams.saved ? <p className="epci-alert-success" data-testid="organizer-game-success">{organizerSavedMessage(searchParams.saved)}</p> : null}

      <section className="epci-card">
        <h2 className="font-black">Players & Waitlist</h2>
        <div className="mt-3 space-y-2" data-testid="organizer-participants">
          {game.participations.map((p) => (
            <div key={p.id} className="epci-mini-surface grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto] md:items-center" data-testid={`organizer-participant-${p.user.name}`}>
              <div className="flex items-center gap-3">
                <PlayerAvatar photoUrl={p.user.photoUrl} name={p.user.name} lastName={p.user.lastName} size="sm" />
                <div>
                  <p className="font-semibold">{p.user.name} {p.user.lastName} · {p.user.level.toFixed(1)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusBadge type="participation" status={p.status} />
                    <StatusBadge type="payment" status={p.paymentStatus} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isPaymentEditable(p.status) && p.paymentStatus !== "PAID" ? (
                  <ParticipantButton id={p.id} gameId={game.id} actionName="paid" label="Paid" testId={`paid-${p.user.name}`} confirmMessage={`Mark payment for ${p.user.name} ${p.user.lastName}?`} />
                ) : null}
                {isPaymentEditable(p.status) && p.paymentStatus === "PAID" ? (
                  <ParticipantButton id={p.id} gameId={game.id} actionName="unpaid" label="Unpaid" testId={`unpaid-${p.user.name}`} confirmMessage={`Mark ${p.user.name} ${p.user.lastName} as "unpaid"?`} />
                ) : null}
                {attendanceCanBeMarked && (p.status === ParticipationStatus.JOINED || p.status === ParticipationStatus.PLAYED) ? (
                  <ParticipantButton id={p.id} gameId={game.id} actionName="no_show" label="No-show" testId={`no-show-${p.user.name}`} confirmMessage={`Mark ${p.user.name} ${p.user.lastName} as no-show?`} />
                ) : null}
                {attendanceCanBeMarked && p.status === ParticipationStatus.NO_SHOW ? (
                  <ParticipantButton id={p.id} gameId={game.id} actionName="played" label="Played" testId={`played-${p.user.name}`} confirmMessage={`Mark ${p.user.name} ${p.user.lastName} as played?`} />
                ) : null}
                {rosterCanBeChanged && p.status === ParticipationStatus.WAITING ? <ParticipantButton id={p.id} gameId={game.id} actionName="joined" label="Approve" testId={`join-waiting-${p.user.name}`} confirmMessage={`Approve ${p.user.name} ${p.user.lastName} for the game?`} /> : null}
                {rosterCanBeChanged && p.status === ParticipationStatus.JOINED ? <ParticipantButton id={p.id} gameId={game.id} actionName="waiting" label="Move to Waitlist" testId={`to-waiting-${p.user.name}`} confirmMessage={`Move ${p.user.name} ${p.user.lastName} to the waitlist?`} /> : null}
              </div>
            </div>
          ))}
          {!game.participations.length ? <EmptyState message="No players yet" /> : null}
        </div>
      </section>

      <RankedMatchPanel
        gameId={game.id}
        isManager
        isAdmin={currentUser.role === UserRole.ADMIN}
        redirectTo={`/organizer/games/${game.id}`}
        currentUserId={currentUser.id}
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

      {rosterCanBeChanged ? (
        <section className="epci-card">
          <h2 className="font-black">Add Players to Game</h2>
          <p className="mt-1 text-sm text-ink/55">Eligible Levels: {formatLevelRange(game.minLevel, game.maxLevel)}</p>
          <PlayerMultiSelect
            action={addParticipantsAction}
            players={eligibleUsers.map((user) => ({
              id: user.id,
              name: user.name,
              lastName: user.lastName,
              email: user.email,
              level: user.level
            }))}
            hiddenFields={{ gameId: game.id }}
            freeSlots={rosterCanBeChanged ? Math.max(0, game.maxPlayers - joinedCount(game)) : undefined}
            testIdPrefix="admin-add-player"
            submitTestId="admin-add-player-button"
            emptyMessage="No players with eligible levels"
          />
        </section>
      ) : null}
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

function isPaymentEditable(status: string) {
  return ([ParticipationStatus.JOINED, ParticipationStatus.PLAYED, ParticipationStatus.NO_SHOW] as readonly string[]).includes(status);
}

function StatusButton({ gameId, status, label, testId, confirmMessage, disabled = false }: { gameId: string; status: GameStatusType; label: string; testId: string; confirmMessage: string; disabled?: boolean }) {
  return (
    <form action={setGameStatusAction}>
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="status" value={status} />
      <ConfirmSubmitButton className="epci-btn-secondary px-3 py-2" confirmMessage={confirmMessage} disabled={disabled} label={label} testId={testId} />
    </form>
  );
}

function ParticipantButton({ id, gameId, actionName, label, testId, confirmMessage }: { id: string; gameId: string; actionName: string; label: string; testId: string; confirmMessage: string }) {
  return (
    <form action={participationAction}>
      <input type="hidden" name="participationId" value={id} />
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="action" value={actionName} />
      <ConfirmSubmitButton className="epci-btn-secondary px-3 py-2" confirmMessage={confirmMessage} label={label} testId={testId} />
    </form>
  );
}

function organizerSavedMessage(saved?: string) {
  if (saved === "created") return "Game created.";
  if (saved === "game") return "Game details saved.";
  if (saved === "status") return "Game status updated.";
  if (saved === "participant") return "Player updated.";
  if (saved === "participants") return "Players added to the game.";
  return "Changes saved.";
}
