import { createClubAction, deleteClubAction, updateClubAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Клубы" : "Clubs" };
}

export default async function AdminClubsPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  await requireAdmin();
  const clubs = await prisma.club.findMany({
    where: { deletedAt: null },
    orderBy: [{ city: "asc" }, { name: "asc" }]
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="epci-page-title">Clubs</h1>
        <p className="epci-muted mt-2">Manage clubs used for games and tournaments.</p>
      </div>
      {searchParams.saved ? <p className="epci-alert-success" data-testid="club-success">{clubSavedMessage(searchParams.saved)}</p> : null}
      {searchParams.error ? <p className="epci-alert-error" data-testid="club-error">Check the club details and try again.</p> : null}

      <form action={createClubAction} className="epci-card grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_0.8fr_auto]" data-testid="club-create-form">
        <Field name="name" label="Club Name" testId="club-name" />
        <Field name="city" label="City" testId="club-city" />
        <Field name="address" label="Address" testId="club-address" />
        <Field name="hourlyCourtPrice" label="Hourly Rate" type="number" step="0.01" testId="club-price" />
        <div className="flex items-end">
          <SubmitButton className="epci-btn-primary w-full" label="Create" testId="club-create" />
        </div>
      </form>

      <div className="epci-table" data-testid="clubs-list">
        <div className="epci-table-head grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_5rem_6rem]">
          <span>Club</span>
          <span>City</span>
          <span>Address</span>
          <span>Hourly Rate</span>
          <span className="md:col-span-2">Actions</span>
        </div>
        {clubs.map((club) => (
          <div key={club.id} className="epci-table-row grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_5rem_6rem]" data-testid={`club-row-${club.name}`}>
            <form action={updateClubAction} className="contents">
              <input type="hidden" name="clubId" value={club.id} />
              <input className="epci-field mt-0" name="name" defaultValue={club.name} aria-label="Club Name" data-testid={`club-edit-name-${club.name}`} />
              <input className="epci-field mt-0" name="city" defaultValue={club.city} aria-label="City" data-testid={`club-edit-city-${club.name}`} />
              <input className="epci-field mt-0" name="address" defaultValue={club.address} aria-label="Address" data-testid={`club-edit-address-${club.name}`} />
              <input className="epci-field mt-0" name="hourlyCourtPrice" type="number" step="0.01" defaultValue={formatMoney(club.hourlyCourtPrice)} aria-label="Hourly Rate" data-testid={`club-edit-price-${club.name}`} />
              <SubmitButton className="epci-btn-secondary px-3 py-2" label="Save" testId={`club-save-${club.name}`} />
            </form>
            <form action={deleteClubAction}>
              <input type="hidden" name="clubId" value={club.id} />
              <ConfirmSubmitButton
                className="epci-btn-danger w-full px-3 py-2"
                confirmMessage={`Delete club ${club.name}?`}
                label="Delete"
                testId={`club-delete-${club.name}`}
              />
            </form>
          </div>
        ))}
        {!clubs.length ? <EmptyState message="No clubs found" className="m-4" /> : null}
      </div>
    </div>
  );
}

function clubSavedMessage(saved?: string) {
  if (saved === "created") return "Club created.";
  if (saved === "updated") return "Club saved.";
  if (saved === "deleted") return "Club deleted.";
  return "Changes saved.";
}

function Field({
  name,
  label,
  testId,
  type = "text",
  step
}: {
  name: string;
  label: string;
  testId: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="epci-label">
      {label}
      <input className="epci-field" name={name} type={type} step={step} required data-testid={testId} />
    </label>
  );
}
