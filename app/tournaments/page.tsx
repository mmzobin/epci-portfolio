import Link from "next/link";
import { redirect } from "next/navigation";
import { joinTournamentAction } from "@/app/tournaments/actions";
import { EmptyState } from "@/components/empty-state";
import { TrophyIcon } from "@/components/place-badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { getTournamentActionState, type ActionState } from "@/lib/action-states";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TournamentParticipantStatus, TournamentStatus } from "@/lib/statuses";
import { getAmericanoData, getFixedPairsData, sortTournamentParticipants, TournamentFormat } from "@/lib/tournaments";
import { HIDDEN_USER_FILTER } from "@/lib/users";
import { translate, translateLabel, type Lang } from "@/lib/dictionaries";
import { getLang } from "@/lib/server-i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(getLang(), "nav.tournaments") };
}

export default async function TournamentsPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const lang = getLang();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const americanoByTournament = new Map<string, Awaited<ReturnType<typeof getAmericanoData>>>();
  const fixedPairsByTournament = new Map<string, Awaited<ReturnType<typeof getFixedPairsData>>>();
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: [TournamentStatus.OPEN, TournamentStatus.COMPLETED, TournamentStatus.CANCELLED] } },
    orderBy: [{ status: "asc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    include: {
      participants: {
        where: { status: { not: TournamentParticipantStatus.REMOVED } },
        include: { user: { select: { id: true, name: true, lastName: true, photoUrl: true } } },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  for (const tnmt of tournaments) {
    // Schedule + results are visible to everyone (including after completion) for transparency.
    if ((tnmt as { format?: string }).format === TournamentFormat.AMERICANO && (tnmt as { scheduleReady?: boolean }).scheduleReady) {
      americanoByTournament.set(tnmt.id, await getAmericanoData(tnmt.id));
    }
    if ((tnmt as { format?: string }).format === TournamentFormat.FIXED_PAIRS) {
      fixedPairsByTournament.set(tnmt.id, await getFixedPairsData(tnmt.id));
    }
  }

  // Members for the "register with a partner" picker (only needed when an open
  // fixed-pairs tournament is on the page).
  const needsPartnerPicker = user && tournaments.some(
    (tnmt) => (tnmt as { format?: string }).format === TournamentFormat.FIXED_PAIRS
      && tnmt.status === TournamentStatus.OPEN
      && !(tnmt as { scheduleReady?: boolean }).scheduleReady
  );
  const partnerOptions = needsPartnerPicker
    ? (await prisma.user.findMany({
        where: { deactivatedAt: null, id: { not: user!.id }, ...HIDDEN_USER_FILTER },
        orderBy: [{ name: "asc" }, { lastName: "asc" }],
        select: { id: true, name: true, lastName: true }
      })).map((u) => ({ id: u.id, name: `${u.name} ${u.lastName}` }))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="epci-page-title">{t("tour.title")}</h1>
          <p className="epci-muted mt-2">{t("tour.subtitle")}</p>
        </div>
        <Link className="epci-btn-secondary" href="/ranking">
          {t("tour.leaderboard")}
        </Link>
      </div>

      {searchParams.error ? <p className="epci-alert-error">{searchParams.error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2" data-testid="tournaments-list">
        {tournaments.map((tournament) => {
          const currentParticipation = user ? tournament.participants.find((participant) => participant.userId === user.id) : null;
          const action = getTournamentActionState({
            currentParticipationStatus: currentParticipation?.status,
            isLoggedIn: Boolean(user),
            tournamentStatus: tournament.status
          });
          const isFixedPairs = (tournament as { format?: string }).format === TournamentFormat.FIXED_PAIRS;
          const fp = fixedPairsByTournament.get(tournament.id);
          const fpScheduled = Boolean(fp && (tournament as { scheduleReady?: boolean }).scheduleReady);
          const canJoinWithPartner = isFixedPairs && tournament.status === TournamentStatus.OPEN && !fpScheduled && Boolean(user) && !currentParticipation;
          return (
            <section key={tournament.id} className="epci-card" data-testid={`tournament-card-${tournament.title}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <StatusBadge type="tournament" status={tournament.status} lang={lang} />
                  <h2 className="mt-2 text-xl font-black text-ink">{tournament.title}</h2>
                  <p className="mt-1 text-sm font-medium text-ink/55">{tournament.startsAt ? formatDate(tournament.startsAt, lang) : t("tour.date_tbd")}</p>
                  <p className="text-sm font-medium text-ink/55">{[tournament.city, tournament.club].filter(Boolean).join(" · ") || t("tour.location_tbd")}</p>
                </div>
                <div className="epci-mini-surface px-3 py-2 text-center text-sm">
                  <p className="font-black text-ink">{tournament.participants.length}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t("tour.players")}</p>
                </div>
              </div>

              {tournament.status === TournamentStatus.COMPLETED ? (
                <>
                  <CompletedStandings participants={tournament.participants} lang={lang} finalLabel={t("tour.final")} emptyLabel={t("tour.no_participants")} />
                  {americanoByTournament.get(tournament.id) ? (
                    <PublicAmericano data={americanoByTournament.get(tournament.id)!} lang={lang} currentUserId={user?.id ?? null} showStandings={false} />
                  ) : null}
                  {fp ? <PublicFixedPairs data={fp} lang={lang} currentUserId={user?.id ?? null} showStandings={false} /> : null}
                </>
              ) : fpScheduled ? (
                <PublicFixedPairs data={fp!} lang={lang} currentUserId={user?.id ?? null} />
              ) : isFixedPairs ? (
                <FixedPairsRoster data={fp!} lang={lang} currentUserId={user?.id ?? null} />
              ) : americanoByTournament.get(tournament.id) ? (
                <PublicAmericano data={americanoByTournament.get(tournament.id)!} lang={lang} currentUserId={user?.id ?? null} />
              ) : (
                <div className="mt-4 space-y-2 text-sm">
                  {tournament.participants.map((participant) => (
                    <div key={participant.id} className="epci-mini-surface flex items-center justify-between px-3 py-2">
                      <span>{participant.user.name} {participant.user.lastName}</span>
                      <StatusBadge type="tournamentParticipant" status={participant.status} lang={lang} />
                    </div>
                  ))}
                  {!tournament.participants.length ? <EmptyState message={t("tour.no_participants")} className="min-h-20" /> : null}
                </div>
              )}

              <div className="mt-4">
                {canJoinWithPartner ? (
                  <JoinWithPartner tournamentId={tournament.id} partnerOptions={partnerOptions} lang={lang} testId={`join-tournament-${tournament.title}`} />
                ) : (
                  <TournamentAction action={action} tournamentId={tournament.id} testId={`join-tournament-${tournament.title}`} lang={lang} />
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!tournaments.length ? <EmptyState message={t("tour.no_tournaments")} /> : null}
    </div>
  );
}

type StandingsParticipant = {
  id: string;
  status: string;
  matchesPlayed: number;
  wins: number;
  place: number | null;
  user: { id: string; name: string; lastName: string; photoUrl: string | null };
};

function CompletedStandings({ participants, lang, finalLabel, emptyLabel }: { participants: StandingsParticipant[]; lang: Lang; finalLabel: string; emptyLabel: string }) {
  const joined = participants.filter((participant) => participant.status === TournamentParticipantStatus.JOINED);
  // Completed tournaments store the final place (Americano orders by points, Mini by the formula).
  const played = joined.every((p) => p.place != null)
    ? [...joined].sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
    : sortTournamentParticipants(joined);
  const rest = participants.filter((participant) => participant.status !== TournamentParticipantStatus.JOINED);

  // Group players into tiers by their shared place (the engine ties two players
  // only when wins AND head-to-head are equal). Podium = top 3 tiers (gold /
  // silver / bronze); a tier can hold several players. Lower tiers go to a list.
  const tiers: StandingsParticipant[][] = [];
  for (const p of played) {
    const last = tiers[tiers.length - 1];
    if (last && last[0].place != null && last[0].place === p.place) last.push(p);
    else tiers.push([p]);
  }
  const podiumTiers = tiers.slice(0, 3);
  const listedTiers = tiers.slice(3);
  const arrangement = [
    { tier: podiumTiers[1], ordinal: 2 },
    { tier: podiumTiers[0], ordinal: 1 },
    { tier: podiumTiers[2], ordinal: 3 }
  ];

  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{finalLabel}</p>

      {played.length ? (
        <>
          <div className="flex items-end justify-center gap-2 rounded-2xl border border-line/80 bg-porcelain p-3">
            {arrangement.map((slot, index) =>
              slot.tier ? (
                <PodiumTier key={slot.ordinal} players={slot.tier} ordinal={slot.ordinal} />
              ) : (
                <span key={`spacer-${index}`} className="flex-1" />
              )
            )}
          </div>
          {listedTiers.length ? (
            <div className="space-y-2">
              {listedTiers.map((tier, tierIndex) =>
                tier.map((participant) => (
                  <Link key={participant.id} href={`/ranking/${participant.user.id}`} className="epci-mini-surface flex items-center gap-2.5 px-3 py-2 outline-none transition hover:border-court/30" data-testid={`standing-${tierIndex + 4}-${participant.user.name}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-court-soft text-xs font-black text-court">{tierIndex + 4}</span>
                    <PlayerAvatar photoUrl={participant.user.photoUrl} name={participant.user.name} lastName={participant.user.lastName} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-bold">{participant.user.name} {participant.user.lastName}</span>
                    <span className="text-xs font-bold text-ink/45">{participant.wins}–{participant.matchesPlayed - participant.wins}</span>
                  </Link>
                ))
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {rest.map((participant) => (
        <Link key={participant.id} href={`/ranking/${participant.user.id}`} className="epci-mini-surface flex items-center justify-between gap-2 px-3 py-2 outline-none transition hover:border-court/30">
          <span className="flex min-w-0 items-center gap-2">
            <PlayerAvatar photoUrl={participant.user.photoUrl} name={participant.user.name} lastName={participant.user.lastName} size="sm" />
            <span className="truncate">{participant.user.name} {participant.user.lastName}</span>
          </span>
          <StatusBadge type="tournamentParticipant" status={participant.status} lang={lang} />
        </Link>
      ))}
      {!participants.length ? <EmptyState message={emptyLabel} className="min-h-20" /> : null}
    </div>
  );
}

function PodiumTier({ players, ordinal }: { players: StandingsParticipant[]; ordinal: number }) {
  const first = players[0];
  const ring = ordinal === 1 ? "ring-amber-400" : ordinal === 2 ? "ring-zinc-300" : "ring-orange-300";
  const badgeBg = ordinal === 1 ? "#f0b429" : ordinal === 2 ? "#c2cad3" : "#cf8a4a";
  const badgeColor = ordinal === 1 ? "#4a3500" : ordinal === 2 ? "#2f3640" : "#ffffff";
  const pedestal = ordinal === 1 ? "h-12 bg-amber-200/60" : ordinal === 2 ? "h-9 bg-zinc-200/70" : "h-6 bg-orange-200/60";
  const shown = players.slice(0, 3);
  const extra = players.length - shown.length;
  const names = players.map((p) => `${p.user.name} ${p.user.lastName.charAt(0)}.`).join(" · ");

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      {ordinal === 1 ? <TrophyIcon className="mb-1 text-amber-500" /> : null}
      <div className="flex items-center justify-center">
        {shown.map((p, i) => (
          <Link key={p.id} href={`/ranking/${p.user.id}`} className={`relative inline-flex rounded-full ring-2 ${ring} outline-none transition hover:-translate-y-0.5`} style={{ marginLeft: i > 0 ? -10 : 0, zIndex: shown.length - i }}>
            <PlayerAvatar photoUrl={p.user.photoUrl} name={p.user.name} lastName={p.user.lastName} size={ordinal === 1 ? "md" : "sm"} />
          </Link>
        ))}
        {extra > 0 ? <span className="ml-1 text-xs font-black text-ink/50">+{extra}</span> : null}
      </div>
      <p className="mt-2 line-clamp-2 w-full text-[0.7rem] font-black leading-tight text-ink">{names}</p>
      <p className="text-[0.68rem] font-bold text-ink/45">{first.wins}–{first.matchesPlayed - first.wins}</p>
      <div className={`relative mt-1.5 flex w-full items-center justify-center rounded-t-md ${pedestal}`}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black shadow" style={{ background: badgeBg, color: badgeColor }}>{ordinal}</span>
      </div>
    </div>
  );
}

type AmericanoMatch = { id: string; court: number; team1aId: string; team1bId: string; team2aId: string; team2bId: string; team1Score: number | null; team2Score: number | null };
type AmericanoRound = { id: string; number: number; matches: AmericanoMatch[] };

function PublicAmericano({
  data,
  lang,
  currentUserId,
  showStandings = true
}: {
  data: NonNullable<Awaited<ReturnType<typeof getAmericanoData>>>;
  lang: Lang;
  currentUserId: string | null;
  showStandings?: boolean;
}) {
  const tt = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const nameOf = (id: string) => {
    const n = data.names.get(id);
    return n ? `${n.name} ${n.lastName}` : "—";
  };
  const PlayerName = ({ id, className = "" }: { id: string; className?: string }) => (
    <Link href={`/ranking/${id}`} className={`outline-none transition hover:text-court hover:underline ${className}`}>{nameOf(id)}</Link>
  );
  const inMatch = (m: AmericanoMatch) => Boolean(currentUserId) && [m.team1aId, m.team1bId, m.team2aId, m.team2bId].includes(currentUserId ?? "");

  const rounds = data.rounds as AmericanoRound[];
  const total = rounds.length;
  const currentRound = rounds.find((r) => r.matches.some((m) => m.team1Score == null && m.team2Score == null)) ?? null;

  return (
    <div className="mt-4 space-y-3 text-sm">
      {showStandings && data.standings.length ? (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{tt("tour.standings")}</p>
          <div className="space-y-1">
            {data.standings.map((s) => (
              <Link key={s.userId} href={`/ranking/${s.userId}`} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 outline-none transition hover:brightness-95 ${s.userId === currentUserId ? "bg-limeball/20" : "bg-court-soft/50"}`}>
                <span className="w-4 font-black text-court">{s.place}</span>
                <PlayerAvatar photoUrl={data.names.get(s.userId)?.photoUrl ?? null} name={data.names.get(s.userId)?.name ?? "?"} lastName={data.names.get(s.userId)?.lastName ?? ""} size="sm" />
                <span className="min-w-0 flex-1 truncate font-bold">{nameOf(s.userId)}</span>
                <span className="text-xs font-black text-court">{s.wins} W</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {currentRound ? (
        <div className="rounded-2xl border-2 border-court/40 bg-court-soft/40 p-3">
          <p className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.1em] text-court">
            <span>● {tt("tour.now")}</span>
            <span className="text-ink/45">{tt("tour.round")} {currentRound.number} {tt("tour.of")} {total}</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {currentRound.matches.map((m) => (
              <div key={m.id} className={`rounded-xl border bg-porcelain p-2.5 ${inMatch(m) ? "border-limeball ring-1 ring-limeball" : "border-line/70"}`}>
                <p className="mb-1 flex items-center justify-between text-[0.6rem] font-bold uppercase text-ink/40">
                  <span>{tt("tour.court")} {m.court}</span>
                  {inMatch(m) ? <span className="rounded bg-limeball px-1.5 py-0.5 text-court-dark">{tt("tour.you")}</span> : null}
                </p>
                <p className="truncate font-bold text-ink"><PlayerName id={m.team1aId} /> & <PlayerName id={m.team1bId} /></p>
                <p className="my-0.5 text-[0.6rem] font-black text-ink/35">vs</p>
                <p className="truncate font-bold text-ink"><PlayerName id={m.team2aId} /> & <PlayerName id={m.team2bId} /></p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-court-soft/50 px-3 py-2 text-xs font-bold text-court">{tt("tour.finished")}</p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer list-none text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/45">{tt("tour.schedule")}</summary>
        <div className="mt-2 space-y-2">
          {rounds.map((round) => {
            const status = currentRound && round.number < currentRound.number ? "done" : currentRound && round.number === currentRound.number ? "now" : "upcoming";
            return (
              <div key={round.id} className={status === "upcoming" ? "opacity-55" : ""}>
                <p className="text-[0.6rem] font-bold uppercase text-ink/40">
                  {tt("tour.round")} {round.number}
                  {status === "done" ? ` · ${tt("tour.done")}` : status === "now" ? ` · ${tt("tour.now")}` : ` · ${tt("tour.upcoming")}`}
                </p>
                {round.matches.map((m) => {
                  const won1 = m.team1Score === 1;
                  const won2 = m.team2Score === 1;
                  return (
                    <div key={m.id} className={`mt-1 flex items-center gap-2 rounded-lg border bg-porcelain px-2.5 py-1.5 ${inMatch(m) ? "border-limeball/70" : "border-line/70"}`}>
                      <span className={`min-w-0 flex-1 truncate ${won1 ? "font-black text-court" : ""}`}>{won1 ? "✓ " : ""}<PlayerName id={m.team1aId} /> & <PlayerName id={m.team1bId} /></span>
                      <span className="shrink-0 text-ink/35">{won1 || won2 ? "" : "vs"}</span>
                      <span className={`min-w-0 flex-1 truncate text-right ${won2 ? "font-black text-court" : ""}`}><PlayerName id={m.team2aId} /> & <PlayerName id={m.team2bId} />{won2 ? " ✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function PublicFixedPairs({
  data,
  lang,
  currentUserId,
  showStandings = true
}: {
  data: Awaited<ReturnType<typeof getFixedPairsData>>;
  lang: Lang;
  currentUserId: string | null;
  showStandings?: boolean;
}) {
  const tt = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const nameOf = (id: string) => {
    const n = data.names.get(id);
    return n ? `${n.name} ${n.lastName}` : "—";
  };
  const PlayerName = ({ id, className = "" }: { id: string; className?: string }) => (
    <Link href={`/ranking/${id}`} className={`outline-none transition hover:text-court hover:underline ${className}`}>{nameOf(id)}</Link>
  );
  const inMatch = (m: AmericanoMatch) => Boolean(currentUserId) && [m.team1aId, m.team1bId, m.team2aId, m.team2bId].includes(currentUserId ?? "");

  const rounds = data.rounds as unknown as AmericanoRound[];
  const total = rounds.length;
  const currentRound = rounds.find((r) => r.matches.some((m) => m.team1Score == null && m.team2Score == null)) ?? null;

  return (
    <div className="mt-4 space-y-3 text-sm">
      {showStandings && data.standings.length ? (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{tt("fp.table")}</p>
          <div className="space-y-1">
            {data.standings.map((s) => {
              const mine = s.players.some((pl) => pl.id === currentUserId);
              return (
                <div key={s.pairId} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${mine ? "bg-limeball/20" : "bg-court-soft/50"}`}>
                  <span className="w-4 font-black text-court">{s.place}</span>
                  <div className="flex -space-x-2">
                    {s.players.map((pl) => (
                      <Link key={pl.id} href={`/ranking/${pl.id}`} className="rounded-full ring-2 ring-white">
                        <PlayerAvatar photoUrl={pl.photoUrl} name={pl.name} lastName={pl.lastName} size="sm" />
                      </Link>
                    ))}
                  </div>
                  <span className="min-w-0 flex-1 truncate font-bold leading-tight">
                    {s.players.map((pl, i) => (
                      <span key={pl.id}>{i > 0 ? " & " : ""}<PlayerName id={pl.id} /></span>
                    ))}
                  </span>
                  <span className="text-xs font-black text-court">{s.wins} W</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {currentRound ? (
        <div className="rounded-2xl border-2 border-court/40 bg-court-soft/40 p-3">
          <p className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.1em] text-court">
            <span>● {tt("tour.now")}</span>
            <span className="text-ink/45">{tt("tour.round")} {currentRound.number} {tt("tour.of")} {total}</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {currentRound.matches.map((m) => (
              <div key={m.id} className={`rounded-xl border bg-porcelain p-2.5 ${inMatch(m) ? "border-limeball ring-1 ring-limeball" : "border-line/70"}`}>
                <p className="mb-1 flex items-center justify-between text-[0.6rem] font-bold uppercase text-ink/40">
                  <span>{tt("tour.court")} {m.court}</span>
                  {inMatch(m) ? <span className="rounded bg-limeball px-1.5 py-0.5 text-court-dark">{tt("tour.you")}</span> : null}
                </p>
                <p className="truncate font-bold text-ink"><PlayerName id={m.team1aId} /> & <PlayerName id={m.team1bId} /></p>
                <p className="my-0.5 text-[0.6rem] font-black text-ink/35">vs</p>
                <p className="truncate font-bold text-ink"><PlayerName id={m.team2aId} /> & <PlayerName id={m.team2bId} /></p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-court-soft/50 px-3 py-2 text-xs font-bold text-court">{tt("tour.finished")}</p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer list-none text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/45">{tt("tour.schedule")}</summary>
        <div className="mt-2 space-y-2">
          {rounds.map((round) => {
            const status = currentRound && round.number < currentRound.number ? "done" : currentRound && round.number === currentRound.number ? "now" : "upcoming";
            return (
              <div key={round.id} className={status === "upcoming" ? "opacity-55" : ""}>
                <p className="text-[0.6rem] font-bold uppercase text-ink/40">
                  {tt("tour.round")} {round.number}
                  {status === "done" ? ` · ${tt("tour.done")}` : status === "now" ? ` · ${tt("tour.now")}` : ` · ${tt("tour.upcoming")}`}
                </p>
                {round.matches.map((m) => {
                  const won1 = m.team1Score === 1;
                  const won2 = m.team2Score === 1;
                  return (
                    <div key={m.id} className={`mt-1 flex items-center gap-2 rounded-lg border bg-porcelain px-2.5 py-1.5 ${inMatch(m) ? "border-limeball/70" : "border-line/70"}`}>
                      <span className={`min-w-0 flex-1 truncate ${won1 ? "font-black text-court" : ""}`}>{won1 ? "✓ " : ""}<PlayerName id={m.team1aId} /> & <PlayerName id={m.team1bId} /></span>
                      <span className="shrink-0 text-ink/35">{won1 || won2 ? "" : "vs"}</span>
                      <span className={`min-w-0 flex-1 truncate text-right ${won2 ? "font-black text-court" : ""}`}><PlayerName id={m.team2aId} /> & <PlayerName id={m.team2bId} />{won2 ? " ✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function FixedPairsRoster({
  data,
  lang,
  currentUserId
}: {
  data: Awaited<ReturnType<typeof getFixedPairsData>>;
  lang: Lang;
  currentUserId: string | null;
}) {
  const tt = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const nameOf = (id: string) => {
    const n = data.names.get(id);
    return n ? `${n.name} ${n.lastName}` : "—";
  };
  const photoOf = (id: string) => data.names.get(id)?.photoUrl ?? null;
  const Player = ({ id }: { id: string }) => (
    <Link href={`/ranking/${id}`} className="flex min-w-0 items-center gap-1.5 outline-none transition hover:text-court">
      <PlayerAvatar photoUrl={photoOf(id)} name={nameOf(id).split(" ")[0]} lastName={nameOf(id).split(" ").slice(1).join(" ")} size="sm" />
      <span className="truncate font-bold">{nameOf(id)}</span>
    </Link>
  );

  return (
    <div className="mt-4 space-y-2 text-sm">
      {data.pairs.map((pair) => {
        const mine = pair.player1 === currentUserId || pair.player2 === currentUserId;
        return (
          <div key={pair.id} className={`epci-mini-surface flex items-center justify-between gap-2 px-3 py-2 ${mine ? "border-limeball/70" : ""}`}>
            <Player id={pair.player1} />
            <span className="shrink-0 text-xs font-black text-ink/35">&amp;</span>
            <Player id={pair.player2} />
          </div>
        );
      })}
      {data.unpaired.map((p) => (
        <div key={p.userId} className="epci-mini-surface flex items-center justify-between gap-2 px-3 py-2">
          <Player id={p.userId} />
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-amber-700">{tt("fp.unpaired")}</span>
        </div>
      ))}
      {!data.pairs.length && !data.unpaired.length ? <EmptyState message={tt("tour.no_participants")} className="min-h-20" /> : null}
    </div>
  );
}

function JoinWithPartner({
  tournamentId,
  partnerOptions,
  lang,
  testId
}: {
  tournamentId: string;
  partnerOptions: { id: string; name: string }[];
  lang: Lang;
  testId: string;
}) {
  const tt = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  return (
    <form action={joinTournamentAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <label className="epci-label flex-1">
        {tt("fp.choose_partner")}
        <select name="partnerId" className="epci-field" defaultValue="">
          <option value="">{tt("fp.no_partner")}</option>
          {partnerOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <SubmitButton className="epci-btn-primary sm:w-auto" label={tt("fp.join_with_partner")} testId={testId} />
    </form>
  );
}

function formatDate(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function TournamentAction({ action, testId, tournamentId, lang }: { action: ActionState; testId: string; tournamentId: string; lang: Lang }) {
  if (action.kind === "none") return null;
  if (action.kind === "link") {
    return (
      <Link className="epci-btn-primary" href={action.href} data-testid={testId}>
        {translateLabel(lang, action.label)}
      </Link>
    );
  }
  if (action.kind === "disabled") {
    return (
      <button className="epci-btn-secondary text-ink/45" data-testid={testId} disabled type="button">
        {translateLabel(lang, action.label)}
      </button>
    );
  }
  return (
    <form action={joinTournamentAction}>
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <SubmitButton className="epci-btn-primary" label={translateLabel(lang, action.label)} testId={testId} />
    </form>
  );
}
