import { redirect } from "next/navigation";
import { saveLevelAssessmentAction } from "@/app/level-assessment/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { levelAssessmentQuestions, levelDescription, levelFromScore } from "@/lib/level-assessment";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Результат опроса" : "Level result" };
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LevelAssessmentResultPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const score = calculateScore(searchParams);
  if (score === null) redirect("/level-assessment");

  const level = levelFromScore(score);
  const { lang, t } = getT();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="epci-card" data-testid="assessment-result">
        <p className="epci-kicker">{t("assess.result.your")}: {level.toFixed(2)}</p>
        <h1 className="epci-page-title mt-2">{t("assess.result.level")} {level.toFixed(2)}</h1>
        <p className="mt-3 leading-7 text-ink/70">{levelDescription(level, lang)}</p>
        <form action={saveLevelAssessmentAction} className="mt-5">
          <input type="hidden" name="score" value={score} />
          <input type="hidden" name="level" value={level} />
          <SubmitButton className="epci-btn-primary" label={t("assess.result.save")} testId="save-assessment" />
        </form>
      </section>
    </div>
  );
}

function calculateScore(searchParams: SearchParams) {
  let total = 0;
  for (const question of levelAssessmentQuestions) {
    const rawValue = searchParams[question.id];
    const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
    if (values.length === 0) return null;
    if (question.type === "single" && values.length !== 1) return null;
    for (const value of values) {
      const option = question.options[Number(value)];
      if (!option) return null;
      total += option.points;
    }
  }
  return total;
}
