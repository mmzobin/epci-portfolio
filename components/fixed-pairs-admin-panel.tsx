import Link from "next/link";
import {
  clearTournamentPairAction,
  completeFixedPairsAction,
  generateFixedPairsScheduleAction,
  regenerateFixedPairsScheduleAction,
  setAmericanoScoreAction,
  setTournamentPairAction
} from "@/app/admin/tournaments/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { translate, type DictKey, type Lang } from "@/lib/dictionaries";

type Match = {
  id: string;
  court: number;
  team1aId: string;
  team1bId: string;
  team2aId: string;
  team2bId: string;
  team1Score: number | null;
  team2Score: number | null;
};
type Round = { id: string; number: number; matches: Match[] };
type Standing = { pairId: string; place: number; wins: number; matchesPlayed: number; players: { id: string; name: string; lastName: string }[] };
type Participant = { userId: string; partnerId: string | null; name: string };

export function FixedPairsAdminPanel({
  tournamentId,
  lang,
  scheduleReady,
  isCompleted,
  participants,
  rounds,
  standings,
  names
}: {
  tournamentId: string;
  lang: Lang;
  scheduleReady: boolean;
  isCompleted: boolean;
  participants: Participant[];
  rounds: Round[];
  standings: Standing[];
  names: Record<string, string>;
}) {
  const t = (key: DictKey) => translate(lang, key);
  const nameOf = (id: string) => names[id] ?? "—";

  const unpaired = participants.filter((p) => !p.partnerId);
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const p of participants) {
    if (!p.partnerId || seen.has(p.userId)) continue;
    seen.add(p.userId);
    seen.add(p.partnerId);
    pairs.push([p.userId, p.partnerId]);
  }

  if (!scheduleReady && !isCompleted) {
    return (
      <section className="epci-card">
        <h2 className="font-black">{t("fp.pairs")}</h2>
        <p className="mt-1 text-sm text-ink/55">{t("fp.need_pairs")}</p>

        {pairs.length ? (
          <div className="mt-3 space-y-1.5">
            {pairs.map(([a, b]) => (
              <div key={`${a}-${b}`} className="flex items-center gap-2 rounded-lg bg-court-soft/50 px-3 py-2 text-sm">
                <span className="flex-1 truncate font-bold">{nameOf(a)} &amp; {nameOf(b)}</span>
                <form action={clearTournamentPairAction}>
                  <input type="hidden" name="tournamentId" value={tournamentId} />
                  <input type="hidden" name="userId" value={a} />
                  <button type="submit" className="epci-btn-ghost px-2 py-1 text-xs">{t("fp.unpair")}</button>
                </form>
              </div>
            ))}
          </div>
        ) : null}

        {unpaired.length >= 2 ? (
          <form action={setTournamentPairAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <label className="epci-label flex-1">
              {t("fp.player1")}
              <select name="user1Id" className="epci-field" defaultValue="" required>
                <option value="" disabled>—</option>
                {unpaired.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
              </select>
            </label>
            <label className="epci-label flex-1">
              {t("fp.player2")}
              <select name="user2Id" className="epci-field" defaultValue="" required>
                <option value="" disabled>—</option>
                {unpaired.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
              </select>
            </label>
            <SubmitButton className="epci-btn-secondary px-3 py-2.5" label={t("fp.make_pair")} testId="make-pair" />
          </form>
        ) : unpaired.length === 1 ? (
          <p className="mt-3 text-sm text-ink/55">{t("fp.unpaired")}: {unpaired[0].name}</p>
        ) : null}

        {pairs.length >= 2 && unpaired.length === 0 ? (
          <form action={generateFixedPairsScheduleAction} className="mt-4">
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <SubmitButton className="epci-btn-primary" label={t("fp.generate")} testId="generate-fixed-pairs" />
          </form>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {standings.length ? (
        <section className="epci-card">
          <h2 className="font-black">{t("fp.table")}</h2>
          <div className="mt-3 space-y-1.5">
            {standings.map((s) => (
              <div key={s.pairId} className="flex items-center gap-3 rounded-lg bg-court-soft/50 px-3 py-2 text-sm">
                <span className="w-5 font-black text-court">{s.place}</span>
                <span className="flex-1 truncate font-bold">
                  {s.players.map((pl, i) => (
                    <span key={pl.id}>
                      {i > 0 ? " & " : ""}
                      <Link href={`/ranking/${pl.id}`} className="hover:text-court hover:underline">{pl.name} {pl.lastName}</Link>
                    </span>
                  ))}
                </span>
                <span className="text-xs text-ink/50">{s.matchesPlayed} {t("am.matches")}</span>
                <span className="font-black text-court">{s.wins} {t("am.wins")}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!isCompleted ? (
        <section className="epci-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black">{t("am.rounds_mark")}</h2>
            <div className="flex flex-wrap gap-2">
              <form action={regenerateFixedPairsScheduleAction}>
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <ConfirmSubmitButton className="epci-btn-ghost px-3 py-2 text-sm" confirmMessage={t("am.regenerate_confirm")} label={t("am.regenerate")} testId="regenerate-fixed-pairs" />
              </form>
              <form action={completeFixedPairsAction}>
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <ConfirmSubmitButton className="epci-btn-secondary px-3 py-2" confirmMessage={t("am.complete_confirm")} label={t("at.complete")} testId="complete-fixed-pairs" />
              </form>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {rounds.map((round) => (
              <div key={round.id}>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-ink/45">{t("tour.round")} {round.number}</p>
                <div className="space-y-2">
                  {round.matches.map((m) => {
                    const won1 = m.team1Score === 1;
                    const won2 = m.team2Score === 1;
                    return (
                      <form key={m.id} action={setAmericanoScoreAction} className="flex items-center gap-2 rounded-xl border border-line/80 bg-porcelain p-2 text-sm">
                        <input type="hidden" name="tournamentId" value={tournamentId} />
                        <input type="hidden" name="matchId" value={m.id} />
                        <span className="hidden text-[0.6rem] font-bold uppercase text-ink/40 sm:block">{t("tour.court")} {m.court}</span>
                        <TeamButton names={`${nameOf(m.team1aId)} & ${nameOf(m.team1bId)}`} value="1" won={won1} />
                        <span className="shrink-0 text-xs font-black text-ink/35">vs</span>
                        <TeamButton names={`${nameOf(m.team2aId)} & ${nameOf(m.team2bId)}`} value="2" won={won2} />
                      </form>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TeamButton({ names, value, won }: { names: string; value: "1" | "2"; won: boolean }) {
  return (
    <button
      type="submit"
      name="winner"
      value={value}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1 truncate rounded-lg border px-2 py-2 text-center transition ${
        won ? "border-court bg-court-soft font-black text-court" : "border-line bg-white text-ink/70 hover:border-court/40"
      }`}
    >
      {won ? <span aria-hidden="true">✓</span> : null}
      <span className="truncate">{names}</span>
    </button>
  );
}
