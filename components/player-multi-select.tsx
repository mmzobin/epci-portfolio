"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";

export type SelectablePlayer = {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  level: number;
};

type PlayerMultiSelectProps = {
  action: (formData: FormData) => Promise<void>;
  players: SelectablePlayer[];
  hiddenFields: Record<string, string>;
  testIdPrefix: string;
  submitTestId: string;
  emptyMessage: string;
  freeSlots?: number;
};

export function PlayerMultiSelect({ action, players, hiddenFields, testIdPrefix, submitTestId, emptyMessage, freeSlots }: PlayerMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const filteredPlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players;
    return players.filter((player) =>
      `${player.name} ${player.lastName ?? ""} ${player.email}`.toLowerCase().includes(needle)
    );
  }, [players, query]);

  if (!players.length) {
    return <EmptyState message={emptyMessage} className="mt-3 min-h-20" />;
  }

  const selectedCount = selectedIds.size;
  const waitlistedCount = freeSlots !== undefined ? Math.max(0, selectedCount - freeSlots) : 0;

  const togglePlayer = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form action={action} className="mt-3 space-y-3">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {Array.from(selectedIds).map((id) => (
        <input key={id} type="hidden" name="userIds" value={id} />
      ))}
      <input
        className="epci-field mt-0"
        type="search"
        placeholder="Search by name or email…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        data-testid={`${testIdPrefix}-search`}
      />
      <div className="epci-mini-surface max-h-64 divide-y divide-line/70 overflow-y-auto" data-testid={`${testIdPrefix}-options`}>
        {filteredPlayers.map((player) => (
          <label key={player.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-court-soft/60">
            <input
              className="h-4 w-4 shrink-0 cursor-pointer accent-court"
              type="checkbox"
              checked={selectedIds.has(player.id)}
              onChange={() => togglePlayer(player.id)}
              data-testid={`${testIdPrefix}-option-${player.name}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{player.name} {player.lastName}</span>
              <span className="block truncate text-xs text-ink/55">{player.email}</span>
            </span>
            <span className="inline-flex shrink-0 items-center rounded-full border border-court/20 bg-court-soft px-2.5 py-1 text-xs font-black leading-4 text-court">
              {player.level.toFixed(1)}
            </span>
          </label>
        ))}
        {!filteredPlayers.length ? <p className="px-3 py-4 text-sm text-ink/55">No players match “{query.trim()}”.</p> : null}
      </div>
      {waitlistedCount > 0 ? (
        <p className="epci-alert-warning" data-testid={`${testIdPrefix}-waitlist-note`}>
          {freeSlots === 0 ? "No free slots" : `Only ${freeSlots} free ${freeSlots === 1 ? "slot" : "slots"}`} — {waitlistedCount} {waitlistedCount === 1 ? "player" : "players"} will go to the waitlist.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          className="epci-btn-primary"
          disabled={!selectedCount}
          label={selectedCount > 1 ? `Add ${selectedCount} Players` : "Add Player"}
          testId={submitTestId}
        />
        {selectedCount ? (
          <button
            type="button"
            className="text-sm font-bold text-ink/55 transition hover:text-ink"
            onClick={() => setSelectedIds(new Set())}
            data-testid={`${testIdPrefix}-clear`}
          >
            Clear selection ({selectedCount})
          </button>
        ) : (
          <span className="text-sm text-ink/55">Select one or more players</span>
        )}
      </div>
    </form>
  );
}
