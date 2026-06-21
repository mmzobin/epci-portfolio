import type { Metadata } from "next";
import { getRatingRanking, type RatingEntry } from "@/lib/ranking";
import { RankingBoard, type BoardEntry } from "@/components/ranking-board";
import { getT } from "@/lib/server-i18n";
import { requireUser } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getT();
  return { title: t("nav.ranking") };
}

function toBoardEntry(entry: RatingEntry): BoardEntry {
  return {
    userId: entry.userId,
    name: entry.name,
    lastName: entry.lastName,
    photoUrl: entry.photoUrl,
    city: entry.city,
    rating: entry.rating,
    band: entry.band,
    matchesPlayed: entry.matchesPlayed,
    place: entry.place,
    movement: entry.movement
  };
}

export default async function RankingPage() {
  await requireUser();
  const { ranked, unranked } = await getRatingRanking();
  const { t } = getT();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="epci-page-title">{t("ranking.title")}</h1>
        <p className="epci-muted mt-2">{t("ranking.subtitle")}</p>
      </div>

      <RankingBoard ranked={ranked.map(toBoardEntry)} unranked={unranked.map(toBoardEntry)} />
    </div>
  );
}
