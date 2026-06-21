"use client";

import { useMemo, useState } from "react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { TournamentParticipantStatus } from "@/lib/statuses";

export type TournamentResultRow = {
  participationId: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  level: number;
  status: string;
  matchesPlayed: number;
  wins: number;
};

type TournamentResultsEditorProps = {
  tournamentId: string;
  isCompleted: boolean;
  participants: TournamentResultRow[];
  saveAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

type RowValues = { matches: string; wins: string };

const RESULTS_FORM_ID = "tournament-results-form";
const GRID = "md:grid-cols-[minmax(0,0.5fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_6rem_6rem_minmax(0,0.7fr)_10.5rem]";

export function TournamentResultsEditor({ tournamentId, isCompleted, participants, saveAction, removeAction }: TournamentResultsEditorProps) {
  const initialValues = useMemo(() => {
    const values: Record<string, RowValues> = {};
    for (const participant of participants) {
      values[participant.participationId] = { matches: String(participant.matchesPlayed), wins: String(participant.wins) };
    }
    return values;
  }, [participants]);
  const [overrides, setOverrides] = useState<Record<string, RowValues>>({});
  const [quickFill, setQuickFill] = useState("");

  // The roster can change under this component via server actions without a remount,
  // so state only stores user edits and falls back to server values per row.
  const rowValues = (participationId: string): RowValues => overrides[participationId] ?? initialValues[participationId];

  const rowEditable = (participant: TournamentResultRow) => !isCompleted && participant.status !== TournamentParticipantStatus.WAITING;
  const editableRows = participants.filter(rowEditable);
  const dirtyCount = editableRows.filter((participant) => {
    const current = rowValues(participant.participationId);
    const initial = initialValues[participant.participationId];
    return current.matches !== initial.matches || current.wins !== initial.wins;
  }).length;
  const invalidCount = editableRows.filter((participant) => !isRowValid(rowValues(participant.participationId))).length;

  const setRowValue = (participationId: string, field: keyof RowValues, value: string) => {
    setOverrides((current) => ({
      ...current,
      [participationId]: { ...(current[participationId] ?? initialValues[participationId]), [field]: value }
    }));
  };

  const applyQuickFill = () => {
    const matches = Number(quickFill);
    if (!Number.isInteger(matches) || matches < 0) return;
    setOverrides((current) => {
      const next = { ...current };
      for (const participant of editableRows) {
        next[participant.participationId] = {
          ...(next[participant.participationId] ?? initialValues[participant.participationId]),
          matches: String(matches)
        };
      }
      return next;
    });
  };

  return (
    <section className="space-y-3">
      {!isCompleted && editableRows.length ? (
        <div className="epci-card-compact flex flex-wrap items-end gap-3">
          <label className="epci-label">
            Matches for all players
            <input
              className="epci-field w-32"
              type="number"
              min="0"
              value={quickFill}
              onChange={(event) => setQuickFill(event.target.value)}
              placeholder="e.g. 7"
              data-testid="quick-fill-matches"
            />
          </label>
          <button type="button" className="epci-btn-secondary" onClick={applyQuickFill} disabled={quickFill === ""} data-testid="quick-fill-apply">
            Apply to All
          </button>
          <p className="epci-muted">In a round-robin every player has the same number of matches — fill the column in one click, then enter wins only.</p>
        </div>
      ) : null}

      <div className="epci-table">
        <div className={`epci-table-head grid gap-3 ${GRID}`}>
          <span>Rank</span>
          <span>Player</span>
          <span>Status</span>
          <span>Matches</span>
          <span>Wins</span>
          <span>Points</span>
          <span>Action</span>
        </div>
        <div data-testid="tournament-participants">
          {participants.map((participant, index) => {
            const row = rowValues(participant.participationId);
            const editable = rowEditable(participant);
            const valid = isRowValid(row);
            return (
              <div key={participant.participationId} className={`epci-table-row grid gap-3 ${GRID} md:items-center`} data-testid={`tournament-participant-${participant.firstName}`}>
                <span className="font-black text-court">{isCompleted ? index + 1 : "—"}</span>
                <div>
                  <p className="font-black">{participant.firstName} {participant.lastName}</p>
                  <p className="text-ink/55">Level {participant.level.toFixed(1)} · win rate {Math.round(rowWinRate(row))}%</p>
                </div>
                <StatusBadge type="tournamentParticipant" status={participant.status} />
                <input
                  className="epci-field mt-0 w-24"
                  form={RESULTS_FORM_ID}
                  name={`matches-${participant.participationId}`}
                  type="number"
                  min="0"
                  value={row.matches}
                  onChange={(event) => setRowValue(participant.participationId, "matches", event.target.value)}
                  disabled={!editable}
                  aria-label="Matches Played"
                  data-testid={`matches-${participant.firstName}`}
                />
                <input
                  className={`epci-field mt-0 w-24 ${valid ? "" : "border-red-300 focus:border-red-400 focus:ring-red-100"}`}
                  form={RESULTS_FORM_ID}
                  name={`wins-${participant.participationId}`}
                  type="number"
                  min="0"
                  value={row.wins}
                  onChange={(event) => setRowValue(participant.participationId, "wins", event.target.value)}
                  disabled={!editable}
                  aria-label="Wins"
                  data-testid={`wins-${participant.firstName}`}
                />
                <span className="font-black" data-testid={`points-${participant.firstName}`}>{rowPoints(row)}</span>
                <div className="flex flex-wrap gap-2">
                  {!valid ? <p className="text-xs font-bold text-red-700">Wins can’t exceed matches</p> : null}
                  {!isCompleted ? (
                    <form action={removeAction}>
                      <input type="hidden" name="tournamentId" value={tournamentId} />
                      <input type="hidden" name="userId" value={participant.userId} />
                      <ConfirmSubmitButton
                        className="epci-btn-danger px-3 py-2"
                        confirmMessage={`Delete ${participant.firstName} ${participant.lastName} from the tournament?`}
                        label="Delete"
                        testId={`remove-tournament-player-${participant.firstName}`}
                      />
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!participants.length ? <EmptyState message="No participants yet" className="m-4" /> : null}
        </div>
      </div>

      {!isCompleted && editableRows.length ? (
        <form action={saveAction} id={RESULTS_FORM_ID} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <SubmitButton
            className="epci-btn-primary"
            disabled={invalidCount > 0}
            label={dirtyCount > 0 ? `Save All Results (${dirtyCount} changed)` : "Save All Results"}
            testId="save-results"
          />
          {invalidCount > 0 ? (
            <span className="text-sm font-bold text-red-700">Fix {invalidCount} {invalidCount === 1 ? "row" : "rows"} before saving</span>
          ) : dirtyCount > 0 ? (
            <span className="text-sm text-ink/55" data-testid="unsaved-results-note">{dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}</span>
          ) : (
            <span className="text-sm text-ink/55">All results saved</span>
          )}
        </form>
      ) : null}
    </section>
  );
}

function isRowValid(row: RowValues) {
  const matches = Number(row.matches);
  const wins = Number(row.wins);
  return Number.isInteger(matches) && matches >= 0 && Number.isInteger(wins) && wins >= 0 && wins <= matches;
}

function rowPoints(row: RowValues) {
  if (!isRowValid(row)) return "—";
  const matches = Number(row.matches);
  const wins = Number(row.wins);
  return wins * 5 + (matches - wins);
}

function rowWinRate(row: RowValues) {
  if (!isRowValid(row)) return 0;
  const matches = Number(row.matches);
  return matches === 0 ? 0 : (Number(row.wins) / matches) * 100;
}
