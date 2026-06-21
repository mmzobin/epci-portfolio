import { EmptyState } from "@/components/empty-state";
import { GameCard } from "@/components/game-card";
import { GuestHome } from "@/components/guest-home";
import { MiniAppHero } from "@/components/mini-app-hero";
import { getCurrentUser } from "@/lib/auth";
import { listGames, joinedCount } from "@/lib/games";
import { effectiveRating } from "@/lib/levels";
import { prisma } from "@/lib/prisma";
import { TournamentStatus } from "@/lib/statuses";
import { HIDDEN_USER_FILTER } from "@/lib/users";
import { getT } from "@/lib/server-i18n";

export default async function HomePage() {
  const [games, user, playerCount] = await Promise.all([
    listGames(),
    getCurrentUser(),
    prisma.user.count({ where: { deactivatedAt: null, ...HIDDEN_USER_FILTER } })
  ]);

  const { lang, t } = getT();
  const userRating = user ? effectiveRating(user as { skillRating?: number | null; level: number }) : null;

  if (!user) {
    const tournamentCount = await prisma.tournament.count({ where: { status: TournamentStatus.COMPLETED } });
    return (
      <GuestHome
        lang={lang}
        playerCount={playerCount}
        openGames={games.length}
        tournamentCount={tournamentCount}
        games={games.map((game) => ({
          id: game.id,
          startsAt: game.startsAt,
          title: game.title,
          minLevel: game.minLevel,
          maxLevel: game.maxLevel,
          pricePerPlayer: game.pricePerPlayer,
          maxPlayers: game.maxPlayers,
          joined: joinedCount(game)
        }))}
      />
    );
  }

  const canCreate = Boolean(user && ["ORGANIZER", "ADMIN"].includes(user.role));

  return (
    <div className="space-y-8">
      <MiniAppHero
        playerCount={playerCount}
        openGames={games.length}
        userLevel={userRating}
        canCreate={canCreate}
      />

      <section id="games" className="scroll-mt-20">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="epci-section-title">{t("games.title")}</h2>
          <span className="rounded-full bg-court-soft px-3 py-1 text-sm font-black text-court">{games.length} {t("games.available")}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="games-list">
          {games.map((game) => (
            <GameCard key={game.id} game={game} currentUserId={user?.id} currentUserRole={user?.role} userLevel={userRating ?? undefined} />
          ))}
        </div>
        {!games.length ? <EmptyState message={t("games.empty")} /> : null}
      </section>
    </div>
  );
}
