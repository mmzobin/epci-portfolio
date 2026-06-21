import Link from "next/link";
import { updateProfileAction } from "@/app/actions";
import { CitySelect } from "@/components/city-select";
import { EmptyState } from "@/components/empty-state";
import { PlayerAvatar } from "@/components/player-avatar";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { canRetakeAssessment } from "@/lib/level-assessment";
import { ratingToBand } from "@/lib/levels";
import { prisma } from "@/lib/prisma";
import { ParticipationStatus, TournamentParticipantStatus, TournamentStatus } from "@/lib/statuses";
import { getPlayerTournamentStats } from "@/lib/tournaments";
import { getRatingHistory } from "@/lib/ranked";
import { RatingHistory } from "@/components/rating-history";
import { translate, type DictKey, type Lang } from "@/lib/dictionaries";
import { getT } from "@/lib/server-i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getT();
  return { title: t("nav.profile") };
}

export default async function ProfilePage({ searchParams }: { searchParams: { error?: string; updated?: string } }) {
  const user = await requireUser();
  const { lang, t } = getT();
  const [participations, tournamentParticipations, tournamentStats] = await Promise.all([
    prisma.participation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        game: {
          include: {
            participations: {
              where: { status: { in: [ParticipationStatus.JOINED, ParticipationStatus.PLAYED, ParticipationStatus.NO_SHOW] } },
              include: { user: { select: { id: true, name: true, lastName: true } } },
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    }),
    prisma.tournamentParticipation.findMany({
      where: { userId: user.id, status: { not: TournamentParticipantStatus.REMOVED } },
      orderBy: { createdAt: "desc" },
      include: { tournament: true }
    }),
    getPlayerTournamentStats(user.id)
  ]);
  const ratingHistory = await getRatingHistory(user.id);
  const skillRating = (user as { skillRating?: number | null }).skillRating ?? (ratingHistory.length ? ratingHistory[ratingHistory.length - 1].after : null);
  const ratedGames = (user as { ratedGames?: number }).ratedGames ?? ratingHistory.length;
  const attended = participations.filter((p) => p.status === "PLAYED").length;
  const attendance = participations.length ? Math.round((attended / participations.length) * 100) : 0;
  const canRetake = canRetakeAssessment(user.levelAssessmentDate);
  const errorMessage = profileErrorMessage(searchParams.error, t);
  const gameHistory = [
    ...participations.map((participation) => {
      const partner = participation.game.participations
        .map((player) => player.user)
        .find((player) => player.id !== user.id);

      const gm = participation.game as unknown as { id: string; ranked?: boolean; ratingAppliedAt?: Date | null };
      return {
        id: `game-${participation.id}`,
        date: participation.game.startsAt,
        title: participation.game.title,
        result: gameResult(participation.status, t),
        status: <StatusBadge type="participation" status={participation.status} lang={lang} />,
        partner: partner ? `${partner.name} ${partner.lastName}` : null,
        href: gm.ranked && gm.ratingAppliedAt ? `/matches/${gm.id}` : `/games/${gm.id}`
      };
    }),
    ...tournamentParticipations.map((participation) => ({
      id: `tournament-${participation.id}`,
      date: participation.tournament.startsAt ?? participation.tournament.createdAt,
      title: participation.tournament.title,
      result: tournamentResult(participation.place, participation.tournament.status, lang, t),
      status: <StatusBadge type="tournamentParticipant" status={participation.status} lang={lang} />,
      partner: null,
      href: null as string | null
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentActivity = [
    ...participations.map((participation) => ({
      id: `game-activity-${participation.id}`,
      date: participation.updatedAt,
      label: participation.status === ParticipationStatus.PLAYED ? t("prof.a.completed_match") : t("prof.a.joined_match")
    })),
    ...tournamentParticipations.map((participation) => ({
      id: `tournament-activity-${participation.id}`,
      date: participation.tournament.completedAt ?? participation.updatedAt,
      label: participation.tournament.status === TournamentStatus.COMPLETED ? t("prof.a.completed_tour") : t("prof.a.registered_tour")
    })),
    ...(searchParams.updated ? [{ id: "profile-updated", date: new Date(), label: t("prof.a.updated") }] : [])
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  return (
    <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-5">
        <section className="epci-card" data-testid="profile-card">
          <div className="flex items-center gap-4">
            <PlayerAvatar photoUrl={user.photoUrl} name={user.name} lastName={user.lastName} size="lg" />
            <div>
              <h1 className="epci-page-title">{user.name} {user.lastName}</h1>
              <p className="mt-1 text-sm font-medium text-ink/60">{user.city ?? t("prof.city_unknown")} · {t("prof.level")} {ratingToBand(skillRating ?? user.level)}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-court/15 bg-court-soft p-3 text-sm">
            <p className="font-black text-ink">{t("prof.assessment")}</p>
            <p className="mt-1 text-ink/60">
              {user.levelAssessmentDate
                ? `${t("prof.last_time")}: ${new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium" }).format(user.levelAssessmentDate)}`
                : t("prof.not_taken")}
            </p>
            {canRetake ? (
              <a className="epci-btn-primary mt-3" href="/level-assessment" data-testid="retake-assessment">
                {t("prof.retake")}
              </a>
            ) : (
              <button className="epci-btn-secondary mt-3" disabled data-testid="retake-assessment-disabled">
                {t("prof.retake")}
              </button>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Metric label={t("prof.games")} value={String(user.gamesCount)} />
            <Metric label={t("prof.attendance")} value={`${attendance}%`} />
            <Metric label={t("prof.cancellations")} value={String(user.cancellations)} />
            <Metric label={t("prof.noshow")} value={String(user.noShows)} />
          </div>
        </section>
        <section className="epci-card" data-testid="profile-tournament-stats">
          <h2 className="font-black">{t("prof.tour_stats")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Metric label={t("prof.rank")} value={tournamentStats.place ? String(tournamentStats.place) : "—"} />
            <Metric label={t("prof.points")} value={String(tournamentStats.totalPoints)} />
            <Metric label={t("prof.tournaments")} value={String(tournamentStats.tournamentsPlayed)} />
            <Metric label={t("prof.matches")} value={String(tournamentStats.matchesPlayed)} />
            <Metric label={t("prof.wins")} value={String(tournamentStats.wins)} />
            <Metric label={t("prof.winrate")} value={`${Math.round(tournamentStats.winRate)}%`} />
          </div>
          <p className="mt-3 text-sm text-ink/55">
            {t("prof.best")}: {tournamentStats.bestPlace ? `${tournamentStats.bestPlace}` : t("prof.not_yet")}
          </p>
        </section>
        <section className="epci-card" data-testid="profile-edit">
          <h2 className="font-black">{t("prof.edit")}</h2>
          {searchParams.updated ? <p className="epci-alert-success mt-3" data-testid="profile-success">{t("prof.saved")}</p> : null}
          {errorMessage ? <p className="epci-alert-error mt-3" data-testid="profile-error">{errorMessage}</p> : null}
          <form action={updateProfileAction} className="mt-4 grid gap-3 text-sm">
            <ProfileField name="name" label={t("reg.name")} defaultValue={user.name} required testId="profile-edit-name" />
            <ProfileField name="lastName" label={t("reg.last_name")} defaultValue={user.lastName} required testId="profile-edit-last-name" />
            <CitySelect name="city" label={t("reg.city")} defaultValue={user.city} testId="profile-edit-city" />
            <ProfileField name="phone" label={t("reg.phone")} defaultValue={user.phone ?? ""} testId="profile-edit-phone" />
            <ProfileField name="telegramUsername" label={t("reg.telegram")} defaultValue={user.telegramUsername ?? ""} testId="profile-edit-telegram" />
            <label className="epci-label">
              {t("prof.photo")}
              <input className="epci-field" name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" data-testid="profile-edit-avatar-file" />
              <span className="mt-1 block text-xs font-normal text-ink/50">{t("prof.photo_hint")}</span>
            </label>
            <SubmitButton className="epci-btn-primary mt-1" label={t("prof.save")} testId="profile-edit-save" />
          </form>
        </section>
      </div>
      <div className="space-y-5">
        <RatingHistory rating={skillRating} ratedGames={ratedGames} history={ratingHistory} lang={lang} />
        <section className="epci-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black">{t("prof.history")}</h2>
            <span className="rounded-full bg-court-soft px-3 py-1 text-xs font-black text-court">{gameHistory.length} {t("prof.records")}</span>
          </div>
          <div className="mt-3 space-y-3" data-testid="profile-history">
            {gameHistory.map((item) => {
              const inner = (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-court">{formatDate(item.date, lang)}</p>
                      <h3 className="mt-1 font-black text-ink">{item.title}</h3>
                    </div>
                    {item.status}
                  </div>
                  <p className="mt-3 text-sm font-black text-ink">{item.result}</p>
                  {item.partner ? <p className="mt-1 text-sm font-medium text-ink/55">{t("prof.partner")}: {item.partner}</p> : null}
                </>
              );
              return item.href ? (
                <Link key={item.id} href={item.href} className="epci-mini-surface block p-3 text-sm transition hover:border-court/40">{inner}</Link>
              ) : (
                <article key={item.id} className="epci-mini-surface p-3 text-sm">{inner}</article>
              );
            })}
            {!gameHistory.length ? <EmptyState message={t("prof.no_games")} /> : null}
          </div>
        </section>

        <section className="epci-card">
          <h2 className="font-black">{t("prof.activity")}</h2>
          <div className="mt-3 space-y-2" data-testid="profile-activity">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="epci-mini-surface flex items-center gap-3 px-3 py-2 text-sm">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-court-soft text-xs font-black text-court">✓</span>
                <div>
                  <p className="font-black text-ink">{activity.label}</p>
                  <p className="text-xs font-medium text-ink/50">{formatDate(activity.date, lang)}</p>
                </div>
              </div>
            ))}
            {!recentActivity.length ? <EmptyState message={t("prof.no_activity")} className="min-h-20" /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileField({
  name,
  label,
  defaultValue,
  testId,
  type = "text",
  required = false
}: {
  name: string;
  label: string;
  defaultValue: string;
  testId: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="epci-label">
      {label}
      <input className="epci-field" name={name} type={type} defaultValue={defaultValue} required={required} data-testid={testId} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="epci-mini-surface p-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}

function formatDate(date: Date, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium" }).format(date);
}

type T = (key: DictKey) => string;

function gameResult(status: string, t: T) {
  if (status === ParticipationStatus.PLAYED) return t("prof.r.completed");
  if (status === ParticipationStatus.JOINED) return t("prof.r.registered");
  if (status === ParticipationStatus.WAITING) return t("prof.r.waiting");
  if (status === ParticipationStatus.NO_SHOW) return t("prof.r.noshow");
  if (status === ParticipationStatus.CANCELLED) return t("prof.r.cancelled");
  return t("prof.r.registered");
}

function tournamentResult(place: number | null, status: string, lang: Lang, t: T) {
  if (place) return lang === "ru" ? `${place} ${t("prof.r.place")}` : `${ordinal(place)} ${t("prof.r.place")}`;
  if (status === TournamentStatus.COMPLETED) return t("prof.r.completed");
  return t("prof.r.registered");
}

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function profileErrorMessage(error: string | undefined, t: T) {
  if (error === "avatar-config") return t("prof.err_avatar_config");
  if (error === "avatar-type") return t("prof.err_avatar_type");
  if (error === "avatar-size") return t("prof.err_avatar_size");
  if (error === "avatar-upload") return t("prof.err_avatar_upload");
  if (error) return t("prof.err_generic");
  return null;
}
