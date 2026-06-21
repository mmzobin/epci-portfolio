"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type HeroProps = {
  playerCount: number;
  openGames: number;
  userLevel?: number | null;
  canCreate?: boolean;
};

/**
 * Modern, mobile-first padel hero for the Telegram Mini App home.
 * Court-inspired gradient, glass stat row, bold display type, lime accent.
 */
export function MiniAppHero({ playerCount, openGames, userLevel, canCreate }: HeroProps) {
  const { t } = useI18n();

  return (
    <section className="epci-hero">
      <div className="epci-hero-glow" aria-hidden="true" />
      <CourtLines />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/epci-icon.png"
            alt="EPCI"
            width={52}
            height={52}
            className="h-12 w-12 rounded-2xl border border-white/20 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
            priority
          />
          <span className="text-xs font-black uppercase tracking-[0.18em] text-limeball/90">
            {t("hero.kicker")}
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="max-w-[16ch] text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="max-w-[42ch] text-sm leading-6 text-white/75 sm:text-base">{t("hero.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link href="/#games" className="epci-hero-cta-primary" data-testid="hero-games">
            {t("hero.cta.games")}
          </Link>
          {canCreate ? (
            <Link href="/organizer/games/new" className="epci-hero-cta-ghost" data-testid="hero-create">
              {t("hero.cta.create")}
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <Stat value={playerCount} label={t("hero.stat.players")} />
          <Stat value={openGames} label={t("hero.stat.games")} />
          <Stat
            value={typeof userLevel === "number" ? userLevel.toFixed(2) : "—"}
            label={t("hero.stat.level")}
            accent
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className="epci-hero-stat">
      <span className={accent ? "text-2xl font-black text-limeball" : "text-2xl font-black text-white"}>
        {value}
      </span>
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-white/55">{label}</span>
    </div>
  );
}

function CourtLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <rect x="24" y="20" width="352" height="200" rx="6" stroke="#9cff1a" strokeWidth="1.5" />
      <line x1="200" y1="20" x2="200" y2="220" stroke="#9cff1a" strokeWidth="1.5" />
      <line x1="24" y1="120" x2="376" y2="120" stroke="#9cff1a" strokeWidth="1.5" />
      <line x1="96" y1="20" x2="96" y2="220" stroke="#9cff1a" strokeWidth="1" />
      <line x1="304" y1="20" x2="304" y2="220" stroke="#9cff1a" strokeWidth="1" />
    </svg>
  );
}
