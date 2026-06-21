import Link from "next/link";
import { notFound } from "next/navigation";
import { CityLocation } from "@/components/city-location";
import { PlayerAvatar } from "@/components/player-avatar";
import { getPlayerRankingDetail, type PlayerStats } from "@/lib/ranking";
import { getPlayerGameStats, type PlayerGameStats } from "@/lib/ranked";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";
import { requireUser } from "@/lib/auth";
import type { DictKey } from "@/lib/dictionaries";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { lang } = getT();
  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true, lastName: true } });
  return { title: user ? `${user.name} ${user.lastName}` : lang === "ru" ? "Статистика игрока" : "Player stats" };
}

export default async function PlayerRankingPage({ params }: { params: { id: string } }) {
  await requireUser();
  const [detail, game] = await Promise.all([getPlayerRankingDetail(params.id), getPlayerGameStats(params.id)]);
  if (!detail) notFound();
  const { t } = getT();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/ranking" className="inline-flex items-center gap-1.5 text-sm font-black text-court" data-testid="ranking-back">
        <span aria-hidden="true">‹</span> {t("rd.back")}
      </Link>

      <section className="epci-hero">
        <div className="epci-hero-glow" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-4">
          <PlayerAvatar photoUrl={detail.user.photoUrl} name={detail.user.name} lastName={detail.user.lastName} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight text-white">
              {detail.user.name} {detail.user.lastName}
            </h1>
            <CityLocation city={detail.user.city} tone="dark" className="mt-1 text-sm" />
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-3xl font-black leading-none text-limeball">{game.rating != null ? game.rating.toFixed(2) : "—"}</span>
            {game.band ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.62rem] font-black text-limeball">{game.band}</span> : null}
            <span className="text-[0.62rem] font-bold uppercase tracking-wide text-white/55">{t("rd.rating")}</span>
          </div>
        </div>
      </section>

      <GameStatsBlock game={game} t={t} />

      {detail.career.tournamentsPlayed > 0 ? <TournamentsBlock career={detail.career} bestRank={detail.bestRank} t={t} /> : null}
    </div>
  );
}

function GameStatsBlock({ game, t }: { game: PlayerGameStats; t: (key: DictKey) => string }) {
  return (
    <section className="epci-card" data-testid="player-game-stats">
      {game.history.length >= 2 ? <Sparkline values={game.history} /> : null}

      {game.form.length ? (
        <div className="mt-4 flex items-center gap-1.5">
          <span className="mr-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-ink/45">{t("rd.form")}</span>
          {game.form.map((r, i) => (
            <span
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-black ${r === "W" ? "bg-court-soft text-court" : "bg-rose-500/15 text-rose-500"}`}
            >
              {r}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat label={t("rd.matches")} value={String(game.matches)} />
        <Stat label={t("rd.winrate")} value={`${game.winRate}%`} accent />
        <Stat label={t("rd.wl")} value={`${game.wins}–${game.losses}`} />
        <Stat label={t("rd.partners")} value={String(game.partners)} />
      </div>
      <p className="mt-3 text-xs text-ink/45">{t("rd.best_rating")}: {game.bestRating != null ? game.bestRating.toFixed(2) : "—"}</p>
    </section>
  );
}

function TournamentsBlock({ career, bestRank, t }: { career: PlayerStats; bestRank: number | null; t: (key: DictKey) => string }) {
  return (
    <section className="epci-card" data-testid="player-tournament-stats">
      <h2 className="font-black">{t("rd.tournaments")}</h2>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat label={t("rd.best_rank")} value={bestRank != null ? `#${bestRank}` : "—"} accent />
        <Stat label={t("rd.best_finish")} value={career.bestFinish != null ? `#${career.bestFinish}` : "—"} />
        <Stat label={t("rd.titles")} value={String(career.titles)} />
        <Stat label={t("rd.points")} value={String(career.points)} testId="player-tournament-points" />
        <Stat label={t("rd.wl")} value={`${career.wins}–${career.losses}`} />
        <Stat label={t("rd.winrate")} value={`${Math.round(career.winRate)}%`} />
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 312;
  const h = 64;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full text-court" style={{ height: 64 }} role="img" aria-label="rating history">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4} fill="currentColor" />
    </svg>
  );
}

function Stat({ label, value, accent, testId }: { label: string; value: string; accent?: boolean; testId?: string }) {
  return (
    <div className="rounded-xl bg-court-soft/60 px-2 py-2.5 text-center">
      <div className={accent ? "text-lg font-black text-court" : "text-lg font-black text-ink"} data-testid={testId}>{value}</div>
      <div className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink/55">{label}</div>
    </div>
  );
}
