import { notFound } from "next/navigation";
import {
  addTournamentParticipantsAction,
  completeTournamentAction,
  deleteTournamentAction,
  removeTournamentParticipantAction,
  updateTournamentAction,
  updateTournamentResultsAction
} from "@/app/admin/tournaments/actions";
import { AmericanoAdminPanel } from "@/components/americano-admin-panel";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FixedPairsAdminPanel } from "@/components/fixed-pairs-admin-panel";
import { PlayerMultiSelect } from "@/components/player-multi-select";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { TournamentResultsEditor } from "@/components/tournament-results-editor";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HIDDEN_USER_FILTER } from "@/lib/users";
import { TournamentParticipantStatus, TournamentStatus } from "@/lib/statuses";
import { getAmericanoData, getFixedPairsData, sortTournamentParticipants, TournamentFormat } from "@/lib/tournaments";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { lang } = getT();
  const tournament = await prisma.tournament.findUnique({ where: { id: params.id }, select: { title: true } });
  return { title: tournament?.title ?? (lang === "ru" ? "Управление турниром" : "Manage tournament") };
}
import type { DictKey } from "@/lib/dictionaries";

export default async function AdminTournamentPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string; saved?: string };
}) {
  await requireAdmin();
  const { lang, t } = getT();
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        where: { status: { not: TournamentParticipantStatus.REMOVED } },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, lastName: true, email: true, level: true } } }
      }
    }
  });
  if (!tournament) notFound();

  const participantUserIds = tournament.participants.map((participant) => participant.userId);
  const users = await prisma.user.findMany({
    where: { id: { notIn: participantUserIds }, deactivatedAt: null, ...HIDDEN_USER_FILTER },
    orderBy: [{ name: "asc" }, { lastName: "asc" }],
    select: { id: true, name: true, lastName: true, email: true, level: true }
  });
  const isCompleted = tournament.status === TournamentStatus.COMPLETED;
  const joinedParticipants = tournament.participants.filter((participant) => participant.status === TournamentParticipantStatus.JOINED);
  const displayParticipants = isCompleted ? sortTournamentParticipants(joinedParticipants) : tournament.participants;

  const isAmericano = tournament.format === TournamentFormat.AMERICANO;
  const isFixedPairs = tournament.format === TournamentFormat.FIXED_PAIRS;
  const isEngineFormat = isAmericano || isFixedPairs;
  const scheduleReady = Boolean((tournament as { scheduleReady?: boolean }).scheduleReady);
  const americano = isAmericano ? await getAmericanoData(params.id) : null;
  const americanoNames: Record<string, string> = {};
  if (americano) {
    for (const p of americano.participants) americanoNames[p.userId] = `${p.user.name} ${p.user.lastName}`;
  }
  const fixedPairs = isFixedPairs ? await getFixedPairsData(params.id) : null;
  const fixedPairsNames: Record<string, string> = {};
  if (fixedPairs) {
    for (const p of fixedPairs.participants) fixedPairsNames[p.userId] = `${p.user.name} ${p.user.lastName}`;
  }
  const formatKey: DictKey = isAmericano ? "fmt.americano" : isFixedPairs ? "fmt.fixed_pairs" : "fmt.mini";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="epci-page-title">{tournament.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/55">
            <span>{t("at.status")}:</span>
            <StatusBadge type="tournament" status={tournament.status} testId="tournament-status" lang={lang} />
            <span>{t("at.format")}: {t(formatKey)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isEngineFormat ? (
            <form action={completeTournamentAction}>
              <input type="hidden" name="tournamentId" value={tournament.id} />
              <ConfirmSubmitButton
                className="epci-btn-secondary px-3 py-2"
                confirmMessage={t("at.complete_confirm")}
                disabled={isCompleted || joinedParticipants.length === 0}
                label={t("at.complete")}
                testId="complete-tournament"
              />
            </form>
          ) : null}
          <form action={deleteTournamentAction}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <ConfirmSubmitButton
              className="epci-btn-danger px-3 py-2"
              confirmMessage={isCompleted ? t("at.delete_confirm_done") : t("at.delete_confirm")}
              label={t("at.delete")}
              testId="delete-tournament"
            />
          </form>
        </div>
      </div>

      {searchParams.error ? <p className="epci-alert-error" data-testid="tournament-error">{searchParams.error}</p> : null}
      {searchParams.saved ? <p className="epci-alert-success" data-testid="tournament-success">{t(savedMessageKey(searchParams.saved))}</p> : null}

      <section className="epci-card">
        <h2 className="font-black">{t("at.details")}</h2>
        <form action={updateTournamentAction} className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <Field name="title" label={t("at.title_field")} defaultValue={tournament.title} required testId="edit-tournament-title" />
          <Field name="startsAt" label={t("at.datetime")} type="datetime-local" defaultValue={formatDateTimeInput(tournament.startsAt)} testId="edit-tournament-startsAt" />
          <Field name="city" label={t("at.city")} defaultValue={tournament.city ?? ""} testId="edit-tournament-city" disabled={isCompleted} />
          <Field name="club" label={t("at.club")} defaultValue={tournament.club ?? ""} testId="edit-tournament-club" disabled={isCompleted} />
          <SubmitButton className="epci-btn-primary md:col-span-2" label={t("at.save")} testId="edit-tournament-save" />
        </form>
      </section>

      {!isCompleted && !(isEngineFormat && scheduleReady) ? (
        <section className="epci-card">
          <h2 className="font-black">{t("at.add_players")}</h2>
          <p className="mt-1 text-sm text-ink/55">{t("at.add_hint")}</p>
          <PlayerMultiSelect
            action={addTournamentParticipantsAction}
            players={users.map((user) => ({
              id: user.id,
              name: user.name,
              lastName: user.lastName,
              email: user.email,
              level: user.level
            }))}
            hiddenFields={{ tournamentId: tournament.id }}
            testIdPrefix="add-tournament-player"
            submitTestId="add-tournament-player"
            emptyMessage={t("at.all_added")}
          />
        </section>
      ) : null}

      {isAmericano ? (
        <AmericanoAdminPanel
          tournamentId={tournament.id}
          lang={lang}
          scheduleReady={scheduleReady}
          isCompleted={isCompleted}
          joinedCount={joinedParticipants.length}
          rounds={(americano?.rounds ?? []) as never}
          standings={americano?.standings ?? []}
          names={americanoNames}
        />
      ) : isFixedPairs ? (
        <FixedPairsAdminPanel
          tournamentId={tournament.id}
          lang={lang}
          scheduleReady={scheduleReady}
          isCompleted={isCompleted}
          participants={joinedParticipants.map((p) => ({
            userId: p.userId,
            partnerId: (p as { partnerId?: string | null }).partnerId ?? null,
            name: `${p.user.name} ${p.user.lastName}`
          }))}
          rounds={(fixedPairs?.rounds ?? []) as never}
          standings={fixedPairs?.standings ?? []}
          names={fixedPairsNames}
        />
      ) : (
        <TournamentResultsEditor
          tournamentId={tournament.id}
          isCompleted={isCompleted}
          participants={displayParticipants.map((participant) => ({
            participationId: participant.id,
            userId: participant.userId,
            firstName: participant.user.name,
            lastName: participant.user.lastName,
            level: participant.user.level,
            status: participant.status,
            matchesPlayed: participant.matchesPlayed,
            wins: participant.wins
          }))}
          saveAction={updateTournamentResultsAction}
          removeAction={removeTournamentParticipantAction}
        />
      )}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  testId,
  type = "text",
  required = false,
  disabled = false
}: {
  name: string;
  label: string;
  defaultValue: string;
  testId: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="epci-label">
      {label}
      <input className="epci-field" name={name} type={type} defaultValue={defaultValue} required={required} disabled={disabled} data-testid={testId} />
    </label>
  );
}

function formatDateTimeInput(date: Date | null) {
  if (!date) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function savedMessageKey(saved?: string): DictKey {
  if (saved === "1") return "at.saved_details";
  if (saved === "participant") return "at.saved_participant";
  if (saved === "results") return "at.saved_results";
  if (saved === "completed") return "at.saved_completed";
  if (saved === "schedule") return "at.saved_schedule";
  return "at.saved_generic";
}
