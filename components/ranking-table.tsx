"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PlaceBadge, RankMedal } from "@/components/place-badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { useI18n } from "@/lib/i18n";

type RankingRow = {
  userId: string;
  officialPlace: number;
  name: string;
  lastName: string;
  photoUrl: string | null;
  totalPoints: number;
  tournamentsPlayed: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  bestPlace: number | null;
};

type SortKey = "officialPlace" | "totalPoints" | "winRate" | "tournamentsPlayed" | "matchesPlayed" | "wins";
type SortDirection = "asc" | "desc";
type SortState = { key: SortKey; direction: SortDirection } | null;

export function RankingTable({ ranking }: { ranking: RankingRow[] }) {
  const { t } = useI18n();
  const [sort, setSort] = useState<SortState>(null);
  const sortedRanking = useMemo(() => {
    if (!sort) return ranking;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...ranking].sort((a, b) => (a[sort.key] - b[sort.key]) * direction || a.officialPlace - b.officialPlace);
  }, [ranking, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }

  return (
    <div data-testid="ranking-list">
      {/* Mobile: stacked player cards with labelled stats */}
      <div className="space-y-3 md:hidden">
        {sortedRanking.map((player) => (
          <div
            key={player.userId}
            className="rounded-2xl border border-line/90 bg-porcelain p-4 shadow-premium-sm"
            data-testid={`ranking-player-${player.name}`}
          >
            <div className="flex items-center gap-3">
              <RankMedal place={player.officialPlace} />
              <PlayerAvatar photoUrl={player.photoUrl} name={player.name} lastName={player.lastName} />
              <span className="min-w-0 flex-1 truncate font-black">
                {player.name} {player.lastName}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MobileStat label={t("ranking.col.points")} value={player.totalPoints} accent />
              <MobileStat label={t("ranking.col.tournaments")} value={player.tournamentsPlayed} />
              <MobileStat label={t("ranking.col.matches")} value={player.matchesPlayed} />
              <MobileStat label={t("ranking.col.wins")} value={player.wins} />
              <MobileStat label={t("ranking.col.winrate")} value={`${Math.round(player.winRate)}%`} />
              <MobileStat
                label={t("ranking.col.best")}
                value={player.bestPlace ? `#${player.bestPlace}` : "—"}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: sortable table */}
      <div className="epci-table hidden md:block">
        <div className="epci-table-head grid gap-3 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
          <SortButton label="#" sortKey="officialPlace" sort={sort} onToggle={toggleSort} />
          <span>Player</span>
          <SortButton label="Points" sortKey="totalPoints" sort={sort} onToggle={toggleSort} />
          <SortButton label="Tournaments" sortKey="tournamentsPlayed" sort={sort} onToggle={toggleSort} />
          <SortButton label="Matches" sortKey="matchesPlayed" sort={sort} onToggle={toggleSort} />
          <SortButton label="Wins" sortKey="wins" sort={sort} onToggle={toggleSort} />
          <SortButton label="Win Rate" sortKey="winRate" sort={sort} onToggle={toggleSort} />
          <span title="Best place in a single tournament">Best Finish</span>
        </div>
        {sortedRanking.map((player) => (
          <div
            key={player.userId}
            className="epci-table-row grid gap-3 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] md:items-center"
            data-testid={`ranking-row-${player.name}`}
          >
            <RankMedal place={player.officialPlace} size="sm" />
            <div className="flex items-center gap-3">
              <PlayerAvatar photoUrl={player.photoUrl} name={player.name} lastName={player.lastName} />
              <span className="font-black">{player.name} {player.lastName}</span>
            </div>
            <span className="font-black">{player.totalPoints}</span>
            <span>{player.tournamentsPlayed}</span>
            <span>{player.matchesPlayed}</span>
            <span>{player.wins}</span>
            <span>{Math.round(player.winRate)}%</span>
            <span>{player.bestPlace ? <PlaceBadge place={player.bestPlace} /> : "—"}</span>
          </div>
        ))}
      </div>

      {!ranking.length ? <EmptyState message={t("ranking.empty")} className="m-4" /> : null}
    </div>
  );
}

function MobileStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-court-soft/60 px-1.5 py-2 text-center">
      <div className={accent ? "text-lg font-black text-court" : "text-lg font-black text-ink"}>{value}</div>
      <div className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-ink/55">{label}</div>
    </div>
  );
}

function SortButton({
  label,
  sortKey,
  sort,
  onToggle
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onToggle: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;

  return (
    <button className="epci-th-sort w-full" type="button" onClick={() => onToggle(sortKey)}>
      <span>{label}</span>
      {direction ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}
