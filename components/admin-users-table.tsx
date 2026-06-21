"use client";

import { useMemo, useState } from "react";
import { setUserActiveAction, updateUserRoleAction } from "@/app/admin/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { PlayerAvatar } from "@/components/player-avatar";
import { SubmitButton } from "@/components/submit-button";
import { UserRole } from "@/lib/statuses";

type AdminUserRow = {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone: string | null;
  telegramUsername: string | null;
  photoUrl: string | null;
  city: string | null;
  level: number;
  role: string;
  deactivated: boolean;
};

type SortDirection = "asc" | "desc";
type SortState = { direction: SortDirection } | null;

const roles = [UserRole.PLAYER, UserRole.ORGANIZER, UserRole.ADMIN];

export function AdminUsersTable({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  const [sort, setSort] = useState<SortState>(null);
  const sortedUsers = useMemo(() => {
    if (!sort) return users;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...users].sort((a, b) => compareNames(a, b) * direction);
  }, [users, sort]);

  function toggleSort() {
    setSort((current) => {
      if (!current) return { direction: "desc" };
      if (current.direction === "desc") return { direction: "asc" };
      return null;
    });
  }

  return (
    <div className="epci-table" data-testid="admin-users">
      <div className="epci-table-head grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.4fr)_380px]">
        <button className="epci-th-sort w-fit" type="button" onClick={toggleSort}>
          <span>User</span>
          {sort ? <span aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
        </button>
        <span className="hidden md:block">Contacts</span>
        <span className="hidden md:block">City</span>
        <span className="hidden md:block">Level</span>
        <span>Role</span>
      </div>
      {sortedUsers.map((user) => (
        <div key={user.id} className={`epci-table-row grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.4fr)_380px]${user.deactivated ? " opacity-60" : ""}`} data-testid={`admin-user-${user.email}`}>
          <div className="flex items-center gap-3">
            <PlayerAvatar photoUrl={user.photoUrl} name={user.name} lastName={user.lastName} size="sm" />
            <div>
              <p className="font-black">
                {user.name} {user.lastName}
                {user.deactivated ? (
                  <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink/60" data-testid={`deactivated-badge-${user.email}`}>
                    Deactivated
                  </span>
                ) : null}
              </p>
              <p className="text-ink/55">{user.email}</p>
            </div>
          </div>
          <div className="hidden text-ink/60 md:block">
            <p>{user.telegramUsername ? `@${user.telegramUsername}` : "Telegram not specified"}</p>
            <p>{user.phone ?? "Phone not specified"}</p>
          </div>
          <span className="hidden text-ink/60 md:block">{user.city ?? "—"}</span>
          <span className="hidden text-ink/60 md:block">{user.level.toFixed(1)}</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <form action={updateUserRoleAction} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <select className="epci-field mt-0 px-2 py-2" name="role" defaultValue={user.role} data-testid={`role-select-${user.email}`}>
                {roles.map((role) => (
                  <option key={role} value={role}>{role.toLowerCase()}</option>
                ))}
              </select>
              <SubmitButton className="epci-btn-primary px-3 py-2" label="OK" testId={`role-save-${user.email}`} />
            </form>
            <form action={setUserActiveAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="active" value={user.deactivated ? "true" : "false"} />
              {user.deactivated ? (
                <ConfirmSubmitButton
                  className="epci-btn-secondary px-3 py-2"
                  confirmMessage={`Reactivate ${user.name} ${user.lastName}? They will be able to log in and join games again.`}
                  label="Reactivate"
                  testId={`reactivate-${user.email}`}
                />
              ) : (
                <ConfirmSubmitButton
                  className="epci-btn-danger px-3 py-2"
                  confirmMessage={`Deactivate ${user.name} ${user.lastName}? They will not be able to log in or be added to games and tournaments. Their history is kept.`}
                  disabled={user.id === currentUserId}
                  label="Deactivate"
                  testId={`deactivate-${user.email}`}
                />
              )}
            </form>
          </div>
        </div>
      ))}
      {!sortedUsers.length ? <EmptyState message="No users found" className="m-4" /> : null}
    </div>
  );
}

function compareNames(a: AdminUserRow, b: AdminUserRow) {
  return a.name.localeCompare(b.name, "ru")
    || a.lastName.localeCompare(b.lastName, "ru")
    || a.email.localeCompare(b.email, "ru");
}
