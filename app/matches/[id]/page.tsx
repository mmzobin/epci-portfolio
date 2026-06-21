import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchState } from "@/lib/ranked";
import { PlayerAvatar } from "@/components/player-avatar";
import { cityLabel } from "@/lib/cities";
import { getLang } from "@/lib/server-i18n";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const game = await prisma.game.findUnique({ where: { id: params.id }, select: { title: true } });
  return { title: game?.title ?? (getLang() === "ru" ? "Матч" : "Match") };
}

type RoundRow = { idx: number; aPlayer1: string; aPlayer2: string; bPlayer1: string; bPlayer2: string; scoreA: number; scoreB: number };
type ChangeRow = { userId: string; before: number; after: number; delta: number };

function fmtDelta(d: number) {
  const r = Math.round(d * 1000) / 1000;
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(3)}`;
}
function countWins(rounds: RoundRow[], userId: string) {
  let wins = 0;
  for (const r of rounds) {
    const onA = r.aPlayer1 === userId || r.aPlayer2 === userId;
    const onB = r.bPlayer1 === userId || r.bPlayer2 === userId;
    if (onA && r.scoreA > r.scoreB) wins += 1;
    else if (onB && r.scoreB > r.scoreA) wins += 1;
  }
  return wins;
}

export default async function MatchPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) notFound();
  const g = game as unknown as { id: string; title: string; startsAt: Date; city: string; club: string; address: string; ranked?: boolean; ratingAppliedAt?: Date | null };
  // The recap is only meaningful for a ranked match whose rating has been applied.
  if (!g.ranked || !g.ratingAppliedAt) redirect(`/games/${params.id}`);

  const state = await getMatchState(params.id);
  const changes = state.changes as ChangeRow[];
  const rounds = state.rounds as RoundRow[];

  const players = await prisma.user.findMany({
    where: { id: { in: changes.map((c) => c.userId) } },
    select: { id: true, name: true, lastName: true, photoUrl: true }
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "—";

  const lang = getLang();
  const t = (ru: string, en: string) => (lang === "en" ? en : ru);

  const ordered = [...changes].sort((a, b) => b.after - a.after);
  const mine = changes.find((c) => c.userId === user.id) ?? null;
  const wins = countWins(rounds, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/games/${g.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-ink/55 hover:text-ink">
        ← {t("К игре", "Back to game")}
      </Link>

      <section className="epci-card">
        <div className="flex items-center justify-between gap-2">
          <h1 className="epci-page-title">{g.title}</h1>
          <span className="inline-flex items-center rounded-full bg-court-soft px-2.5 py-1 text-xs font-black text-court">{t("РЕЙТИНГ", "RANKED")}</span>
        </div>
        <p className="mt-2 text-sm text-ink/55">
          {new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", { dateStyle: "medium" }).format(g.startsAt)} · {cityLabel(g.city, lang) || g.city} · {t("завершено", "completed")}
        </p>

        {mine ? (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-court/15 bg-court-soft/40 py-5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">{t("твой рейтинг", "your rating")}</span>
            <span className="text-4xl font-black text-ink">{(Math.round(mine.after * 100) / 100).toFixed(2)}</span>
            <span className={`text-sm font-black ${mine.delta >= 0 ? "text-court" : "text-rose-500"}`}>{fmtDelta(mine.delta)}</span>
            <span className="mt-1 text-xs text-ink/55">{t(`${wins} побед из ${rounds.length}`, `${wins} of ${rounds.length} won`)}</span>
          </div>
        ) : null}
      </section>

      <section className="epci-card">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t("Результат", "Result")}</h2>
        <div>
          {ordered.map((row) => {
            const p = byId.get(row.userId);
            const up = row.delta >= 0;
            return (
              <div key={row.userId} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-0">
                {p ? <PlayerAvatar photoUrl={p.photoUrl} name={p.name} lastName={p.lastName} size="sm" /> : null}
                <span className="flex-1 text-sm font-bold">
                  {p ? `${p.name} ${p.lastName}` : row.userId}
                  {row.userId === user.id ? <span className="text-court"> · {t("ты", "you")}</span> : null}
                </span>
                <span className="text-sm font-black tabular-nums">{(Math.round(row.after * 100) / 100).toFixed(2)}</span>
                <span className={`min-w-[68px] text-right text-xs font-black tabular-nums ${up ? "text-court" : "text-rose-500"}`}>{fmtDelta(row.delta)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="epci-card">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t("Счёт", "Score")}</h2>
        <div className="space-y-2">
          {rounds.map((r) => {
            const aWin = r.scoreA >= r.scoreB;
            return (
              <div key={r.idx} className="epci-mini-surface px-3 py-2 text-sm">
                <div className="mb-1 text-xs font-black uppercase tracking-[0.1em] text-ink/40">{t("раунд", "round")} {r.idx + 1}</div>
                <div className="flex items-center gap-2">
                  <span className={`flex-1 ${aWin ? "font-black text-court" : ""}`}>{nameOf(r.aPlayer1)} + {nameOf(r.aPlayer2)}</span>
                  <span className="font-black tabular-nums">{r.scoreA}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`flex-1 ${!aWin ? "font-black text-court" : "text-ink/70"}`}>{nameOf(r.bPlayer1)} + {nameOf(r.bPlayer2)}</span>
                  <span className="tabular-nums text-ink/70">{r.scoreB}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
