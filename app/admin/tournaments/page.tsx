import Link from "next/link";
import { createTournamentAction } from "@/app/admin/tournaments/actions";
import { CityClubSelect } from "@/components/city-club-select";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Управление турнирами" : "Tournament management" };
}

export default async function AdminTournamentsPage({ searchParams }: { searchParams: { deleted?: string; error?: string } }) {
  await requireAdmin();
  const { lang, t } = getT();
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      participants: {
        where: { status: { not: "REMOVED" } },
        select: { id: true, status: true }
      }
    }
  });
  const clubs = await prisma.club.findMany({
    where: { deletedAt: null },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, city: true }
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="epci-page-title">{t("at.management")}</h1>
        <p className="epci-muted mt-2">{t("at.management_sub")}</p>
      </div>

      {searchParams.deleted ? <p className="epci-alert-success" data-testid="tournament-success">{t("at.deleted")}</p> : null}
      {searchParams.error ? <p className="epci-alert-error" data-testid="tournament-error">{t("at.check_data")}</p> : null}

      <form action={createTournamentAction} className="epci-card grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="tournament-create-form">
        <Field name="title" label={t("at.title_field")} testId="tournament-title" required />
        <Field name="startsAt" label={t("at.datetime")} type="datetime-local" testId="tournament-startsAt" />
        <label className="epci-label">
          {t("at.format")}
          <select name="format" className="epci-field" defaultValue="MINI" data-testid="tournament-format">
            <option value="MINI">{t("fmt.mini")}</option>
            <option value="AMERICANO">{t("fmt.americano")}</option>
            <option value="FIXED_PAIRS">{t("fmt.fixed_pairs")}</option>
          </select>
        </label>
        <CityClubSelect clubs={clubs} cityTestId="tournament-city" clubTestId="tournament-club" />
        <Field name="courts" label={t("at.courts")} type="number" defaultValue="1" testId="tournament-courts" />
        <div className="flex items-end lg:col-span-3">
          <SubmitButton className="epci-btn-primary w-full py-2.5" label={t("at.create")} testId="tournament-create" />
        </div>
      </form>

      <div className="epci-table" data-testid="admin-tournaments">
        <div className="epci-table-head grid grid-cols-[1fr_auto_auto] gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_6rem]">
          <span>{t("at.col_tournament")}</span>
          <span className="hidden md:block">{t("at.col_date")}</span>
          <span>{t("at.col_status")}</span>
          <span>{t("at.col_players")}</span>
          <span>{t("at.col_action")}</span>
        </div>
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="epci-table-row grid grid-cols-[1fr_auto_auto] items-center gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_6rem]" data-testid={`admin-tournament-${tournament.title}`}>
            <div>
              <p className="font-black">{tournament.title}</p>
              <p className="text-ink/55">{[tournament.city, tournament.club].filter(Boolean).join(" · ") || t("tour.location_tbd")}</p>
            </div>
            <span className="hidden text-ink/60 md:block">{tournament.startsAt ? formatDate(tournament.startsAt, lang) : t("at.date_not_set")}</span>
            <StatusBadge type="tournament" status={tournament.status} lang={lang} />
            <span>{tournament.participants.length}</span>
            <Link className="epci-btn-secondary px-3 py-2" href={`/admin/tournaments/${tournament.id}`} data-testid={`manage-tournament-${tournament.title}`}>
              {t("at.manage")}
            </Link>
          </div>
        ))}
        {!tournaments.length ? <EmptyState message={t("tour.no_tournaments")} className="m-4" /> : null}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  testId,
  type = "text",
  required = false,
  defaultValue
}: {
  name: string;
  label: string;
  testId: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="epci-label">
      {label}
      <input className="epci-field" name={name} type={type} required={required} defaultValue={defaultValue} data-testid={testId} />
    </label>
  );
}

function formatDate(date: Date, lang: "ru" | "en") {
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
