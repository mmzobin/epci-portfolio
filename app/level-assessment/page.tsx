import { LevelAssessmentForm } from "@/components/level-assessment-form";
import { requireUser } from "@/lib/auth";
import { canRetakeAssessment } from "@/lib/level-assessment";
import { getT } from "@/lib/server-i18n";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Опрос уровня" : "Level test" };
}

export default async function LevelAssessmentPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser();
  const canRetake = canRetakeAssessment(user.levelAssessmentDate);
  const { lang, t } = getT();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="epci-card">
        <p className="epci-kicker">Exclusive Padel Crew Israel</p>
        <h1 className="epci-page-title mt-2">{t("assess.title")}</h1>
        <p className="mt-2 leading-7 text-ink/65">{t("assess.subtitle")}</p>
      </section>

      {searchParams.error === "too-soon" || !canRetake ? (
        <div className="epci-alert-warning p-5" data-testid="assessment-too-soon">
          {t("assess.tooSoon")}
        </div>
      ) : (
        <LevelAssessmentForm lang={lang} />
      )}
    </div>
  );
}
