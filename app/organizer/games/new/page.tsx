import { createGameAction } from "@/app/actions";
import { GameForm } from "@/components/game-form";
import { requireOrganizer } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Новая игра" : "New game" };
}

export default async function NewGamePage({ searchParams }: { searchParams: { error?: string } }) {
  await requireOrganizer();
  const clubs = await prisma.club.findMany({
    where: { deletedAt: null },
    orderBy: [{ city: "asc" }, { name: "asc" }]
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="epci-page-title">New Game</h1>
      {searchParams.error ? <p className="epci-alert-error">{searchParams.error === "game" ? "Check the game details and try again." : decodeURIComponent(searchParams.error)}</p> : null}
      <GameForm action={createGameAction} clubs={clubs.map((club) => ({
        id: club.id,
        name: club.name,
        city: club.city,
        address: club.address,
        hourlyCourtPrice: formatMoney(club.hourlyCourtPrice)
      }))} />
    </div>
  );
}
