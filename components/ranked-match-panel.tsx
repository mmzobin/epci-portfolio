"use client";

import { useState } from "react";
import { applyRatingNowAction, confirmMatchResultAction, recomputeMatchAction, recomputeWithRoundsAction, saveMatchRoundsAction, setGameRankedAction } from "@/app/actions";
import { PlayerAvatar } from "@/components/player-avatar";
import { SubmitButton } from "@/components/submit-button";

export type RankedParticipant = {
  id: string;
  name: string;
  lastName: string;
  photoUrl: string | null;
};

export type RatingChangeRow = { userId: string; before: number; after: number; delta: number };
export type RoundRow = {
  idx: number;
  aPlayer1: string;
  aPlayer2: string;
  bPlayer1: string;
  bPlayer2: string;
  scoreA: number;
  scoreB: number;
};

type Props = {
  gameId: string;
  isManager: boolean;
  isAdmin?: boolean;
  redirectTo?: string;
  currentUserId: string;
  started: boolean;
  participants: RankedParticipant[];
  ranked: boolean;
  appliedAt: string | null;
  rounds: RoundRow[];
  confirmations: { userId: string }[];
  changes: RatingChangeRow[];
  preview: RatingChangeRow[] | null;
  lang?: "ru" | "en";
};

type EditorRound = { aPlayer1: string; aPlayer2: string; bPlayer1: string; bPlayer2: string; scoreA: string; scoreB: string };

const TXT = {
  ru: {
    title: "Рейтинговый матч",
    makeRanked: "Сделать рейтинговой",
    friendlyHint: "Обычная игра — без влияния на рейтинг.",
    makeFriendly: "Убрать из рейтинга",
    needStart: "Ввести счёт можно будет после начала игры.",
    enterScore: "Ввести счёт по раундам",
    round: "Раунд",
    addRound: "Добавить раунд",
    save: "Сохранить результат",
    teamA: "Команда A",
    teamB: "Команда B",
    pending: "Ожидает подтверждения",
    confirmedBy: "Подтвердили",
    confirm: "Подтвердить результат",
    confirmed: "Вы подтвердили",
    applied: "Рейтинг обновлён",
    yourRating: "твой рейтинг",
    result: "Результат",
    score: "Счёт",
    wins: "побед",
    remove: "Убрать",
    applyNow: "Применить сейчас (админ)",
    adminHint: "Обходит подтверждения — только для теста.",
    recompute: "Пересчитать рейтинг (админ)",
    recomputeHint: "Откатывает и применяет заново по текущим настройкам.",
    rankedTag: "РЕЙТИНГ",
    you: "ты",
    editRounds: "Изменить раунды (админ)",
    saveRecompute: "Сохранить и пересчитать",
    errPlayers: "Выберите всех четырёх игроков",
    errDup: "Один игрок не может быть в двух командах",
    errScore: "Введите счёт (целые числа)",
    errWinner: "Должен быть победитель — счёт не равный"
  },
  en: {
    title: "Ranked match",
    makeRanked: "Make it ranked",
    friendlyHint: "Friendly game — no rating impact.",
    makeFriendly: "Remove from rating",
    needStart: "You can enter the score after the game starts.",
    enterScore: "Enter the score per round",
    round: "Round",
    addRound: "Add round",
    save: "Save result",
    teamA: "Team A",
    teamB: "Team B",
    pending: "Awaiting confirmation",
    confirmedBy: "Confirmed",
    confirm: "Confirm result",
    confirmed: "You confirmed",
    applied: "Rating updated",
    yourRating: "your rating",
    result: "Result",
    score: "Score",
    wins: "wins",
    remove: "Remove",
    applyNow: "Apply now (admin)",
    adminHint: "Bypasses confirmations — for testing only.",
    recompute: "Recompute rating (admin)",
    recomputeHint: "Reverts and re-applies with current settings.",
    rankedTag: "RANKED",
    you: "you",
    editRounds: "Edit rounds (admin)",
    saveRecompute: "Save & recompute",
    errPlayers: "Pick all four players",
    errDup: "A player can't be on both teams",
    errScore: "Enter the score (whole numbers)",
    errWinner: "There must be a winner — scores can't be equal"
  }
};

function roundError(r: EditorRound, t: typeof TXT["ru"]): string | null {
  const ids = [r.aPlayer1, r.aPlayer2, r.bPlayer1, r.bPlayer2];
  if (ids.some((id) => !id)) return t.errPlayers;
  if (new Set(ids).size !== 4) return t.errDup;
  const a = Number(r.scoreA);
  const b = Number(r.scoreB);
  if (r.scoreA === "" || r.scoreB === "" || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return t.errScore;
  if (a === b) return t.errWinner;
  return null;
}

function fmtDelta(d: number) {
  const r = Math.round(d * 1000) / 1000;
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(3)}`;
}

function nameOf(participants: RankedParticipant[], id: string) {
  const p = participants.find((x) => x.id === id);
  return p ? p.name : "—";
}

export function RankedMatchPanel(props: Props) {
  const t = TXT[props.lang ?? "ru"];
  const applied = Boolean(props.appliedAt);
  const hasRounds = props.rounds.length > 0;

  if (!props.ranked) {
    if (!props.isManager) return null;
    return (
      <div className="epci-card">
        <h2 className="font-black">{t.title}</h2>
        <p className="mt-2 text-sm text-ink/60">{t.friendlyHint}</p>
        <form action={setGameRankedAction} className="mt-3">
          <input type="hidden" name="gameId" value={props.gameId} />
          <input type="hidden" name="ranked" value="true" />
          <input type="hidden" name="redirectTo" value={props.redirectTo ?? ""} />
          <SubmitButton className="epci-btn-secondary w-full" label={t.makeRanked} testId="make-ranked" />
        </form>
      </div>
    );
  }

  return (
    <div className="epci-card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black">{t.title}</h2>
        <span className="inline-flex items-center rounded-full bg-court-soft px-2.5 py-1 text-xs font-black text-court">{t.rankedTag}</span>
      </div>

      {applied ? (
        <AppliedResult {...props} t={t} />
      ) : hasRounds ? (
        <PendingResult {...props} t={t} />
      ) : props.isManager ? (
        props.started ? (
          <ScoreEditor {...props} t={t} />
        ) : (
          <p className="text-sm text-ink/60">{t.needStart}</p>
        )
      ) : (
        <p className="text-sm text-ink/60">{t.pending}</p>
      )}

      {props.isManager && !applied ? (
        <form action={setGameRankedAction} className="border-t border-line/70 pt-3">
          <input type="hidden" name="gameId" value={props.gameId} />
          <input type="hidden" name="ranked" value="false" />
          <input type="hidden" name="redirectTo" value={props.redirectTo ?? ""} />
          <SubmitButton className="epci-btn-ghost w-full text-sm" label={t.makeFriendly} testId="make-friendly" />
        </form>
      ) : null}
    </div>
  );
}

function RatingRows({
  rows,
  participants,
  currentUserId,
  youLabel,
  dim
}: {
  rows: RatingChangeRow[];
  participants: RankedParticipant[];
  currentUserId: string;
  youLabel: string;
  dim?: boolean;
}) {
  const ordered = [...rows].sort((a, b) => b.after - a.after);
  return (
    <div className={dim ? "opacity-70" : ""}>
      {ordered.map((row) => {
        const p = participants.find((x) => x.id === row.userId);
        const up = row.delta >= 0;
        return (
          <div key={row.userId} className="flex items-center gap-3 border-b border-line/60 py-2 last:border-0" data-testid={`rating-row-${row.userId}`}>
            {p ? <PlayerAvatar photoUrl={p.photoUrl} name={p.name} lastName={p.lastName} size="sm" /> : null}
            <span className="flex-1 text-sm font-bold">
              {p ? `${p.name} ${p.lastName}` : row.userId}
              {row.userId === currentUserId ? <span className="text-court"> · {youLabel}</span> : null}
            </span>
            <span className="text-sm font-black tabular-nums">{(Math.round(row.after * 100) / 100).toFixed(2)}</span>
            <span className={`min-w-[64px] text-right text-xs font-black tabular-nums ${up ? "text-court" : "text-rose-500"}`}>{fmtDelta(row.delta)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreTable({ rounds, participants, t }: { rounds: RoundRow[]; participants: RankedParticipant[]; t: typeof TXT["ru"] }) {
  return (
    <div className="space-y-2">
      {rounds.map((r) => {
        const aWin = r.scoreA >= r.scoreB;
        return (
          <div key={r.idx} className="epci-mini-surface px-3 py-2 text-sm" data-testid={`score-round-${r.idx}`}>
            <div className="flex items-center gap-2">
              <span className={`flex-1 ${aWin ? "font-black text-court" : ""}`}>{nameOf(participants, r.aPlayer1)} + {nameOf(participants, r.aPlayer2)}</span>
              <span className="font-black tabular-nums">{r.scoreA}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`flex-1 ${!aWin ? "font-black text-court" : "text-ink/70"}`}>{nameOf(participants, r.bPlayer1)} + {nameOf(participants, r.bPlayer2)}</span>
              <span className="tabular-nums text-ink/70">{r.scoreB}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppliedResult(props: Props & { t: typeof TXT["ru"] }) {
  const { t } = props;
  const mine = props.changes.find((c) => c.userId === props.currentUserId);
  const wins = countWins(props.rounds, props.currentUserId);
  return (
    <div className="space-y-4">
      {mine ? (
        <div className="flex flex-col items-center py-2">
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.yourRating}</span>
          <span className="text-3xl font-black text-ink">{(Math.round(mine.after * 100) / 100).toFixed(2)}</span>
          <span className={`text-sm font-black ${mine.delta >= 0 ? "text-court" : "text-rose-500"}`}>{fmtDelta(mine.delta)}</span>
          <span className="mt-1 text-xs text-ink/55">{wins} {t.wins} · {props.rounds.length}</span>
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.result}</p>
        <RatingRows rows={props.changes} participants={props.participants} currentUserId={props.currentUserId} youLabel={t.you} />
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.score}</p>
        <ScoreTable rounds={props.rounds} participants={props.participants} t={t} />
      </div>
      {props.isAdmin ? (
        <>
          <form action={recomputeMatchAction} className="border-t border-line/70 pt-3">
            <input type="hidden" name="gameId" value={props.gameId} />
            <input type="hidden" name="redirectTo" value={props.redirectTo ?? ""} />
            <SubmitButton className="epci-btn-ghost w-full text-sm" label={t.recompute} testId="recompute-rating" />
            <p className="mt-1 text-center text-xs text-ink/45">{t.recomputeHint}</p>
          </form>
          <div className="border-t border-line/70 pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.editRounds}</p>
            <ScoreEditor {...props} t={t} recompute />
          </div>
        </>
      ) : null}
    </div>
  );
}

function PendingResult(props: Props & { t: typeof TXT["ru"] }) {
  const { t } = props;
  const confirmedIds = new Set(props.confirmations.map((c) => c.userId));
  // Only players who appear in the rounds need to confirm.
  const roundIds = new Set<string>();
  props.rounds.forEach((r) => [r.aPlayer1, r.aPlayer2, r.bPlayer1, r.bPlayer2].forEach((id) => roundIds.add(id)));
  const toConfirm = props.participants.filter((p) => roundIds.has(p.id));
  const meParticipant = roundIds.has(props.currentUserId);
  const iConfirmed = confirmedIds.has(props.currentUserId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
        <span aria-hidden="true">⏳</span>
        <span>{t.pending} · {toConfirm.filter((p) => confirmedIds.has(p.id)).length}/{toConfirm.length}</span>
      </div>

      {props.preview ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.result}</p>
          <RatingRows rows={props.preview} participants={props.participants} currentUserId={props.currentUserId} youLabel={t.you} dim />
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-ink/45">{t.score}</p>
        <ScoreTable rounds={props.rounds} participants={props.participants} t={t} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {toConfirm.map((p) => (
          <span key={p.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${confirmedIds.has(p.id) ? "border-court/25 bg-court-soft text-court" : "border-line bg-white text-ink/55"}`}>
            <span aria-hidden="true">{confirmedIds.has(p.id) ? "✓" : "·"}</span>{p.name}
          </span>
        ))}
      </div>

      {meParticipant && !iConfirmed ? (
        <form action={confirmMatchResultAction}>
          <input type="hidden" name="gameId" value={props.gameId} />
          <input type="hidden" name="redirectTo" value={props.redirectTo ?? ""} />
          <SubmitButton className="epci-btn-primary w-full" label={t.confirm} testId="confirm-result" />
        </form>
      ) : iConfirmed ? (
        <p className="text-center text-sm font-bold text-court">{t.confirmed}</p>
      ) : null}

      {props.isAdmin ? (
        <form action={applyRatingNowAction} className="border-t border-line/70 pt-3">
          <input type="hidden" name="gameId" value={props.gameId} />
          <input type="hidden" name="redirectTo" value={props.redirectTo ?? ""} />
          <SubmitButton className="epci-btn-secondary w-full text-sm" label={t.applyNow} testId="apply-rating-now" />
          <p className="mt-1 text-center text-xs text-ink/45">{t.adminHint}</p>
        </form>
      ) : null}

      {props.isManager ? <ScoreEditor {...props} t={t} editing /> : null}
    </div>
  );
}

function ScoreEditor(props: Props & { t: typeof TXT["ru"]; editing?: boolean; recompute?: boolean }) {
  const { t, participants } = props;
  const fallback = participants.slice(0, 4).map((p) => p.id);
  const initial: EditorRound[] = props.rounds.length
    ? props.rounds.map((r) => ({
        aPlayer1: r.aPlayer1,
        aPlayer2: r.aPlayer2,
        bPlayer1: r.bPlayer1,
        bPlayer2: r.bPlayer2,
        scoreA: String(r.scoreA),
        scoreB: String(r.scoreB)
      }))
    : [{ aPlayer1: fallback[0] ?? "", aPlayer2: fallback[1] ?? "", bPlayer1: fallback[2] ?? "", bPlayer2: fallback[3] ?? "", scoreA: "", scoreB: "" }];
  const [rows, setRows] = useState<EditorRound[]>(initial);

  const update = (i: number, key: keyof EditorRound, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, { aPlayer1: fallback[0] ?? "", aPlayer2: fallback[1] ?? "", bPlayer1: fallback[2] ?? "", bPlayer2: fallback[3] ?? "", scoreA: "", scoreB: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const errors = rows.map((r) => roundError(r, t));
  const hasError = errors.some(Boolean);
  const payload = JSON.stringify(
    rows.map((r) => ({
      aPlayer1: r.aPlayer1,
      aPlayer2: r.aPlayer2,
      bPlayer1: r.bPlayer1,
      bPlayer2: r.bPlayer2,
      scoreA: Number(r.scoreA) || 0,
      scoreB: Number(r.scoreB) || 0
    }))
  );

  const Pick = ({ i, k }: { i: number; k: keyof EditorRound }) => (
    <select className="epci-field mt-0 flex-1 text-sm" value={rows[i][k]} onChange={(e) => update(i, k, e.target.value)}>
      {participants.map((p) => (
        <option key={p.id} value={p.id}>{p.name} {p.lastName}</option>
      ))}
    </select>
  );

  return (
    <form action={props.recompute ? recomputeWithRoundsAction : saveMatchRoundsAction} className={props.editing ? "border-t border-line/70 pt-3 space-y-3" : "space-y-3"}>
      <input type="hidden" name="gameId" value={props.gameId} />
      <input type="hidden" name="rounds" value={payload} />
      <input type="hidden" name="redirectTo" value={props.redirectTo ?? ""} />
      {!props.editing ? <p className="text-sm text-ink/60">{t.enterScore}</p> : null}

      {rows.map((r, i) => (
        <div key={i} className="epci-mini-surface space-y-2 px-3 py-3" data-testid={`round-editor-${i}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-[0.1em] text-ink/45">{t.round} {i + 1}</span>
            {rows.length > 1 ? (
              <button type="button" className="text-xs font-bold text-rose-500" onClick={() => removeRow(i)}>{t.remove}</button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Pick i={i} k="aPlayer1" /><Pick i={i} k="aPlayer2" />
            <input type="number" min={0} inputMode="numeric" className="epci-field mt-0 w-14 text-center text-sm" value={r.scoreA} onChange={(e) => update(i, "scoreA", e.target.value)} aria-label={`${t.teamA} ${t.score}`} />
          </div>
          <div className="flex items-center gap-2">
            <Pick i={i} k="bPlayer1" /><Pick i={i} k="bPlayer2" />
            <input type="number" min={0} inputMode="numeric" className="epci-field mt-0 w-14 text-center text-sm" value={r.scoreB} onChange={(e) => update(i, "scoreB", e.target.value)} aria-label={`${t.teamB} ${t.score}`} />
          </div>
          {errors[i] ? <p className="text-xs font-bold text-rose-500" data-testid={`round-error-${i}`}>{errors[i]}</p> : null}
        </div>
      ))}

      <div className="flex gap-2">
        <button type="button" className="epci-btn-ghost flex-1 text-sm" onClick={addRow}>+ {t.addRound}</button>
        <SubmitButton className="epci-btn-primary flex-1" label={props.recompute ? t.saveRecompute : t.save} testId="save-rounds" disabled={hasError} />
      </div>
    </form>
  );
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
