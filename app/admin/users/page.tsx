import { AdminUsersTable } from "@/components/admin-users-table";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Игроки" : "Players" };
}

export default async function AdminUsersPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      lastName: true,
      email: true,
      phone: true,
      telegramUsername: true,
      photoUrl: true,
      city: true,
      level: true,
      role: true,
      deactivatedAt: true
    }
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="epci-page-title">User Management</h1>
        <p className="epci-muted mt-2">
          Manage user roles, permissions, and account status.
        </p>
      </div>
      {searchParams.saved ? <p className="epci-alert-success" data-testid="admin-users-success">{savedMessage(searchParams.saved)}</p> : null}
      {searchParams.error ? <p className="epci-alert-error" data-testid="admin-users-error">{errorMessage(searchParams.error)}</p> : null}
      <AdminUsersTable
        currentUserId={admin.id}
        users={users.map(({ deactivatedAt, ...user }) => ({ ...user, deactivated: deactivatedAt !== null }))}
      />
    </div>
  );
}

function savedMessage(saved: string) {
  if (saved === "role") return "User role saved.";
  if (saved === "deactivated") return "User deactivated.";
  if (saved === "reactivated") return "User reactivated.";
  return "Changes saved.";
}

function errorMessage(error: string) {
  if (error === "self-deactivate") return "You cannot deactivate your own account.";
  if (error === "last-admin") return "Cannot deactivate the last active admin.";
  if (error === "not-found") return "User not found.";
  if (error === "activation") return "Could not update the account status.";
  return "Could not save the user role.";
}
