import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { formatLevelRange } from "@/lib/levels";
import { formatMoney } from "@/lib/pricing";
import type { Lang } from "@/lib/dictionaries";

const TELEGRAM_COMMUNITY_URL = "https://t.me/+-2wJPcuWubg2Njky";

export type GuestGame = {
  id: string;
  startsAt: Date;
  title: string;
  minLevel: number;
  maxLevel: number;
  pricePerPlayer: Prisma.Decimal.Value;
  maxPlayers: number;
  joined: number;
};

/**
 * Logged-out landing. Privacy by design: no player names, no exact address/club,
 * no line-up — only date, title, level, price and a locked slot count. Sensitive
 * data (ranking, line-ups, addresses) lives behind login.
 */
export function GuestHome({
  lang,
  playerCount,
  openGames,
  tournamentCount,
  games
}: {
  lang: Lang;
  playerCount: number;
  openGames: number;
  tournamentCount: number;
  games: GuestGame[];
}) {
  const ru = lang === "ru";
  const dateFmt = new Intl.DateTimeFormat(ru ? "ru-RU" : "en-US", { weekday: "short", day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat(ru ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="overflow-hidden rounded-3xl bg-[#0a100d] p-6 text-center text-white">
        <Image src="/brand/epci-icon.png" alt="EPCI" width={64} height={64} priority className="mx-auto h-16 w-16 rounded-2xl ring-1 ring-white/15" />
        <h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">Exclusive Padel<br />Crew Israel</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/65">
          {ru
            ? "Закрытое падел‑сообщество. Вступление и игры — через Telegram."
            : "A private padel community. Joining and games happen in Telegram."}
        </p>
        <a
          href={TELEGRAM_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-limeball px-4 py-3 text-base font-black text-court-dark transition hover:brightness-105"
          data-testid="guest-join-community"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M21.8 4.2 2.9 11.5c-.9.4-.9 1.6 0 1.9l4.8 1.5 1.8 5.7c.3.8 1.3 1 1.9.3l2.6-2.6 4.7 3.5c.7.5 1.7.1 1.9-.7l3-14.3c.2-1-.7-1.8-1.6-1.4Z" /></svg>
          {ru ? "Вступить в сообщество" : "Join the community"}
        </a>
        <p className="mt-3 text-sm text-white/55">
          {ru ? "Уже участник? " : "Already a member? "}
          <Link href="/login" className="font-black text-limeball" data-testid="guest-login">{ru ? "Войти" : "Log in"}</Link>
        </p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Benefit icon="calendar" label={ru ? "Игры в 1 тап" : "Games in one tap"} />
        <Benefit icon="trophy" label={ru ? "Турниры" : "Tournaments"} />
        <Benefit icon="chart" label={ru ? "Рейтинг" : "Ranking"} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="epci-section-title">{ru ? "Что сейчас в игре" : "What's on right now"}</h2>
          <span className="text-sm font-bold text-ink/55">
            {playerCount} {ru ? "игроков" : "players"} · {openGames} {ru ? "игр" : "games"}
            {tournamentCount ? ` · ${tournamentCount} ${ru ? "турниров" : "tournaments"}` : ""}
          </span>
        </div>

        <div className="space-y-2.5">
          {games.slice(0, 4).map((game) => (
            <div key={game.id} className="epci-card-compact flex items-center gap-3">
              <div className="min-w-12 shrink-0 text-center">
                <p className="text-[0.65rem] font-black uppercase text-court">{dateFmt.format(game.startsAt)}</p>
                <p className="text-sm font-black text-ink">{timeFmt.format(game.startsAt)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-ink">{game.title}</p>
                <p className="text-xs font-bold text-ink/55">
                  {ru ? "ур." : "lvl"} {formatLevelRange(game.minLevel, game.maxLevel)} · ₪{formatMoney(game.pricePerPlayer)}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink/[0.05] px-2.5 py-1 text-xs font-black text-ink/55">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                {game.joined}/{game.maxPlayers}
              </span>
            </div>
          ))}
          {!games.length ? (
            <p className="epci-card-compact text-center text-sm text-ink/55">{ru ? "Открытых игр пока нет" : "No open games right now"}</p>
          ) : null}
        </div>

        <Link href="/login" className="epci-btn-secondary mt-4 flex w-full items-center justify-center py-3" data-testid="guest-login-cta">
          {ru ? "Войдите, чтобы видеть состав и записаться" : "Log in to see the line-up and join"}
        </Link>
      </section>
    </div>
  );
}

function Benefit({ icon, label }: { icon: "calendar" | "trophy" | "chart"; label: string }) {
  const paths: Record<string, React.ReactNode> = {
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></>,
    chart: <><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="13" y="8" width="3" height="10" /></>
  };
  return (
    <div className="epci-mini-surface flex flex-col items-center gap-2 px-2 py-4 text-center">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-court" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>
      <span className="text-xs font-black text-ink">{label}</span>
    </div>
  );
}
