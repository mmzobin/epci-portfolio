import Link from "next/link";
import type { RatingHistoryRow } from "@/lib/ranked";

type Props = {
  rating: number | null;
  ratedGames: number;
  history: RatingHistoryRow[];
  lang?: "ru" | "en";
};

const TXT = {
  ru: {
    title: "Рейтинг",
    skill: "игровой рейтинг",
    games: "матчей",
    none: "Сыграй рейтинговый матч, чтобы получить рейтинг.",
    seed: "Старт берётся из твоего уровня.",
    recent: "Последние изменения"
  },
  en: {
    title: "Rating",
    skill: "skill rating",
    games: "matches",
    none: "Play a ranked match to get a rating.",
    seed: "It seeds from your level.",
    recent: "Recent changes"
  }
};

function fmtDelta(d: number) {
  const r = Math.round(d * 1000) / 1000;
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(3)}`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 300;
  const h = 72;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full text-court" role="img" aria-label="rating history" preserveAspectRatio="none" style={{ height: 72 }}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3.5} fill="currentColor" />
    </svg>
  );
}

export function RatingHistory({ rating, ratedGames, history, lang }: Props) {
  const t = TXT[lang ?? "ru"];
  const recent = [...history].reverse().slice(0, 6);
  const values = history.map((r) => r.after);

  return (
    <section className="epci-card" data-testid="profile-rating">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black">{t.title}</h2>
        <span className="rounded-full bg-court-soft px-3 py-1 text-xs font-black text-court">{ratedGames} {t.games}</span>
      </div>

      {rating === null ? (
        <div className="mt-3 text-sm text-ink/60">
          <p>{t.none}</p>
          <p className="mt-1 text-ink/45">{t.seed}</p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-4xl font-black text-ink">{(Math.round(rating * 100) / 100).toFixed(2)}</span>
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.skill}</span>
          </div>
          <Sparkline values={values} />
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.recent}</p>
            <div className="space-y-2">
              {recent.map((row) => (
                <Link
                  key={`${row.gameId}-${row.date.toISOString()}`}
                  href={`/matches/${row.gameId}`}
                  className="epci-mini-surface flex items-center gap-3 px-3 py-2 text-sm transition hover:border-court/40"
                  data-testid="rating-change"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{row.title || "—"}</p>
                    <p className="text-xs font-medium text-ink/50">{new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ru-RU", { dateStyle: "medium" }).format(row.date)}</p>
                  </div>
                  <span className="font-black tabular-nums text-ink">{(Math.round(row.after * 100) / 100).toFixed(2)}</span>
                  <span className={`min-w-[64px] text-right text-xs font-black tabular-nums ${row.delta >= 0 ? "text-court" : "text-rose-500"}`}>{fmtDelta(row.delta)}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
