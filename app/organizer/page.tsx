import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { requireOrganizer } from "@/lib/auth";
import { listOrganizerGames } from "@/lib/games";

import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Мои игры" : "My games" };
}

export default async function OrganizerPage({ searchParams }: { searchParams: { deleted?: string } }) {
  const currentUser = await requireOrganizer();
  const games = await listOrganizerGames(currentUser);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="epci-page-title">Manage Games</h1>
        <Link className="epci-btn-primary" href="/organizer/games/new" data-testid="new-game-link">
          Create Game
        </Link>
      </div>
      {searchParams.deleted ? <p className="epci-alert-success" data-testid="organizer-success">Game deleted.</p> : null}
      <div className="epci-table">
        <div className="epci-table-head grid grid-cols-[minmax(0,1fr)_6.5rem_8.5rem] gap-3">
          <span>Game</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {games.map((game) => (
          <div key={game.id} className="epci-table-row grid grid-cols-[minmax(0,1fr)_6.5rem_8.5rem] items-center gap-3" data-testid={`organizer-game-${game.title}`}>
            <div>
              <p className="font-black">{game.title}</p>
              <p className="text-ink/55">{game.city} · {game.club}</p>
            </div>
            <StatusBadge type="game" status={game.status} testId={statusTestId(game.status)} />
            <Link className="epci-btn-secondary px-3 py-2" href={`/organizer/games/${game.id}`}>
              Manage Match
            </Link>
          </div>
        ))}
        {!games.length ? <EmptyState message="No upcoming matches" className="m-4" /> : null}
      </div>
    </div>
  );
}

function statusTestId(status: string) {
  if (status === "COMPLETED") return "match-badge-Completed";
  if (status === "CANCELLED") return "match-badge-Cancelled";
  if (status === "EXPIRED") return "match-badge-Expired";
  if (status === "FULL") return "match-badge-Full";
  return "game-status";
}
