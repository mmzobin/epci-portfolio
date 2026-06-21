import { levelAssessmentQuestions } from "@/lib/level-assessment";
import { getAssessmentText } from "@/lib/assessment-i18n";
import { translate, type Lang } from "@/lib/dictionaries";
import { SubmitButton } from "@/components/submit-button";

export function LevelAssessmentForm({ lang = "ru" }: { lang?: Lang }) {
  const text = getAssessmentText(lang);

  return (
    <form action="/level-assessment/result" className="space-y-4" data-testid="assessment-form">
      {levelAssessmentQuestions.map((question, index) => {
        const qt = text[question.id];
        const title = qt?.title ?? question.title;
        return (
          <fieldset key={question.id} className="epci-card" data-testid={`assessment-question-${question.id}`}>
            <legend className="sr-only">
              {index + 1}. {title}
            </legend>
            <h2 className="text-lg font-black leading-snug text-ink sm:text-xl">
              {index + 1}. {title}
            </h2>
            <div className="mt-3 grid gap-2">
              {question.options.map((option, optionIndex) => {
                const label = qt?.options[optionIndex] ?? option.label;
                return (
                  <label key={`${question.id}-${optionIndex}`} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium transition hover:border-court/40 hover:bg-court-soft">
                    <input
                      className="h-4 w-4"
                      type={question.type === "multiple" ? "checkbox" : "radio"}
                      name={question.id}
                      value={optionIndex}
                      required={question.type === "single"}
                      data-testid={`assessment-${question.id}-${optionIndex}`}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <SubmitButton className="epci-btn-primary w-full py-3" label={translate(lang, "assess.show")} testId="calculate-assessment" />
    </form>
  );
}
