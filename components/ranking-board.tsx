"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CityLocation } from "@/components/city-location";
import { PlayerAvatar } from "@/components/player-avatar";
import { useI18n } from "@/lib/i18n";

export type BoardEntry = {
  userId: string;
  name: string;
  lastName: string;
  photoUrl: string | null;
  city: string | null;
  rating: number;
  band: string;
  matchesPlayed: number;
  place: number | null;
  movement: number | null;
};

type TierStyle = {
  bg: string;
  accent: string | null;
  ghost: string | null;
  ghostSize: number;
  ring: string;
  ringWidth: number;
  pts: string;
  ptsSize: string;
  hero?: boolean;
  mutedName?: boolean;
};

const RANKED_TIERS: TierStyle[] = [
  { bg: "#10241b", accent: "#cdf24a", ghost: "#cdf24a14", ghostSize: 96, ring: "#cdf24a", ringWidth: 2, pts: "#cdf24a", ptsSize: "text-2xl", hero: true },
  { bg: "#13201a", accent: "#c2cad3", ghost: "#c2cad31c", ghostSize: 66, ring: "#c2cad3", ringWidth: 2, pts: "#cdf24a", ptsSize: "text-xl" },
  { bg: "#121c17", accent: "#cf8a4a", ghost: "#cf8a4a1c", ghostSize: 62, ring: "#cf8a4a", ringWidth: 2, pts: "#cdf24a", ptsSize: "text-xl" },
  { bg: "#101813", accent: "#5d7a6b", ghost: "#5d7a6b17", ghostSize: 58, ring: "#5d7a6b", ringWidth: 2, pts: "#e8efe9", ptsSize: "text-lg" },
  { bg: "#0e1511", accent: "#45594e", ghost: "#45594e17", ghostSize: 56, ring: "#45594e", ringWidth: 2, pts: "#e8efe9", ptsSize: "text-lg" }
];
const REST: TierStyle = { bg: "#0e1410", accent: null, ghost: "#ffffff0a", ghostSize: 52, ring: "#2a3a32", ringWidth: 1, pts: "#e8efe9", ptsSize: "text-lg" };
const UNRANKED: TierStyle = { bg: "#0c120e", accent: null, ghost: null, ghostSize: 0, ring: "#2a3a32", ringWidth: 1, pts: "#7d938a", ptsSize: "text-lg", mutedName: true };

function tierForPlace(place: number | null): TierStyle {
  if (place == null) return REST;
  if (place >= 1 && place <= 5) return RANKED_TIERS[place - 1];
  return REST;
}

export function RankingBoard({ ranked, unranked }: { ranked: BoardEntry[]; unranked: BoardEntry[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    return [...ranked, ...unranked].filter((e) => `${e.name} ${e.lastName}`.toLowerCase().includes(q));
  }, [ranked, unranked, q]);

  const ratingLabel = t("rank.rating");
  const matchesLabel = t("rank.matches_short");

  const placeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of ranked) if (e.place != null) counts.set(e.place, (counts.get(e.place) ?? 0) + 1);
    return counts;
  }, [ranked]);
  const isTied = (place: number | null) => place != null && (placeCounts.get(place) ?? 0) > 1;

  return (
    <div className="rounded-3xl bg-[#0a100d] p-3 text-white sm:p-4">
      <div className="mb-3 flex justify-end">
        <input
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#cdf24a]/60 sm:max-w-56"
          type="search"
          placeholder={t("rank.search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="ranking-search"
        />
      </div>

      {q ? (
        matches.length ? (
          <div className="space-y-2">
            {matches.map((entry) => <Card key={entry.userId} entry={entry} tier={REST} ratingLabel={ratingLabel} matchesLabel={matchesLabel} />)}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-white/45">{t("rank.nothing_found")}</p>
        )
      ) : (
        <>
          {ranked.length ? (
            <div className="space-y-2">
              {ranked.map((entry) => (
                <Card key={entry.userId} entry={entry} tier={tierForPlace(entry.place)} ratingLabel={ratingLabel} matchesLabel={matchesLabel} tied={isTied(entry.place)} />
              ))}
            </div>
          ) : null}

          {unranked.length ? (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 px-1">
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-white/40">{t("rank.not_ranked")}</h2>
                <span className="text-xs text-white/25">· {t("rank.not_ranked_hint")}</span>
              </div>
              <div className="space-y-2">
                {unranked.map((entry) => <Card key={entry.userId} entry={entry} tier={UNRANKED} ratingLabel={ratingLabel} matchesLabel={matchesLabel} />)}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Move({ movement }: { movement: number | null }) {
  if (movement == null || movement === 0) return null;
  const up = movement > 0;
  return (
    <span className="text-[0.65rem] font-black" style={{ color: up ? "#3ec98a" : "#e2554a" }}>
      {up ? "▲" : "▼"} {Math.abs(movement)}
    </span>
  );
}

function Card({ entry, tier, ratingLabel, matchesLabel, tied = false }: { entry: BoardEntry; tier: TierStyle; ratingLabel: string; matchesLabel: string; tied?: boolean }) {
  return (
    <Link
      href={`/ranking/${entry.userId}`}
      className="relative block overflow-hidden rounded-2xl px-4 py-3 outline-none transition active:scale-[0.995] focus-visible:ring-2 focus-visible:ring-[#cdf24a]/50"
      style={{ background: tier.bg, ...(tier.accent ? { borderLeft: `4px solid ${tier.accent}` } : {}) }}
      data-testid={`ranking-player-${entry.name}`}
    >
      {tier.ghost && entry.place != null ? (
        <span className="pointer-events-none absolute -top-3 right-1.5 font-black leading-none" style={{ fontSize: tier.ghostSize, color: tier.ghost }}>{entry.place}</span>
      ) : null}
      <div className="relative flex items-center gap-3">
        <span className="relative inline-flex shrink-0 rounded-full" style={{ boxShadow: `0 0 0 ${tier.ringWidth}px ${tier.ring}` }}>
          <PlayerAvatar photoUrl={entry.photoUrl} name={entry.name} lastName={entry.lastName} size="md" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-base font-black uppercase ${tier.mutedName ? "text-white/75" : "text-white"}`}>{entry.name} {entry.lastName}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <CityLocation city={entry.city} tone="dark" />
            <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-black text-white/80">{entry.band}</span>
            {tied ? (
              <span className="shrink-0 whitespace-nowrap text-[0.7rem] font-bold text-[#cdf24a]/80">
                {entry.matchesPlayed} {matchesLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`font-black leading-none tabular-nums ${tier.ptsSize}`} style={{ color: tier.pts }}>{entry.rating.toFixed(2)}</div>
          {tier.hero ? <div className="mt-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-white/45">{ratingLabel}</div> : null}
          <div className="mt-1"><Move movement={entry.movement} /></div>
        </div>
      </div>
    </Link>
  );
}
