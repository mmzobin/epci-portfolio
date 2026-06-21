import Link from "next/link";
import { completeAmericanoAction, generateAmericanoScheduleAction, regenerateAmericanoScheduleAction, setAmericanoScoreAction } from "@/app/admin/tournaments/actions";
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
type Standing = { userId: string; points: number; wins: number; matchesPlayed: number; place: number };

export function AmericanoAdminPanel({
  tournamentId,
  lang,
  scheduleReady,
  isCompleted,
  joinedCount,
  rounds,
  standings,
  names
}: {
  tournamentId: string;
  lang: Lang;
  scheduleReady: boolean;
  isCompleted: boolean;
  joinedCount: number;
  rounds: Round[];
  standings: Standing[];
  names: Record<string, string>;
}) {
  const t = (key: DictKey) => translate(lang, key);
  const nameOf = (id: string) => names[id] ?? "—";

  if (!scheduleReady && !isCompleted) {
    return (
      <section className="epci-card">
        <h2 className="font-black">{t("am.schedule")}</h2>
        <p className="mt-1 text-sm text-ink/55">{t("am.players_count")}: {joinedCount}. {t("am.need_even")}</p>
        <form action={generateAmericanoScheduleAction} className="mt-3">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <SubmitButton className="epci-btn-primary" label={t("am.generate")} testId="generate-americano" />
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {standings.length ? (
        <section className="epci-card">
          <h2 className="font-black">{t("am.table")}</h2>
          <div className="mt-3 space-y-1.5">
            {standings.map((s) => (
              <Link key={s.userId} href={`/ranking/${s.userId}`} className="flex items-center gap-3 rounded-lg bg-court-soft/50 px-3 py-2 text-sm outline-none transition hover:brightness-95">
                <span className="w-5 font-black text-court">{s.place}</span>
                <span className="flex-1 truncate font-bold">{nameOf(s.userId)}</span>
                <span className="text-xs text-ink/50">{s.matchesPlayed} {t("am.matches")}</span>
                <span className="font-black text-court">{s.wins} {t("am.wins")}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!isCompleted ? (
        <section className="epci-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black">{t("am.rounds_mark")}</h2>
            <div className="flex flex-wrap gap-2">
              <form action={regenerateAmericanoScheduleAction}>
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <ConfirmSubmitButton className="epci-btn-ghost px-3 py-2 text-sm" confirmMessage={t("am.regenerate_confirm")} label={t("am.regenerate")} testId="regenerate-americano" />
              </form>
              <form action={completeAmericanoAction}>
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <ConfirmSubmitButton className="epci-btn-secondary px-3 py-2" confirmMessage={t("am.complete_confirm")} label={t("at.complete")} testId="complete-americano" />
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
