"use client";

import { ISRAELI_CITIES } from "@/lib/cities";
import { useI18n } from "@/lib/i18n";

/**
 * City picker (controlled list of Israeli cities). Stores the canonical value so
 * it maps cleanly to a crest. Keeps any legacy free-text value as a selectable
 * option so existing profiles don't lose their city.
 */
export function CitySelect({
  name,
  label,
  defaultValue,
  testId
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  testId?: string;
}) {
  const { lang } = useI18n();
  const current = defaultValue?.trim() || "";
  const known = ISRAELI_CITIES.some((c) => c.value === current);
  const placeholder = lang === "ru" ? "Не указан" : "Not set";

  return (
    <label className="epci-label">
      {label}
      <select className="epci-field" name={name} defaultValue={current} data-testid={testId}>
        <option value="">{placeholder}</option>
        {current && !known ? <option value={current}>{current}</option> : null}
        {ISRAELI_CITIES.map((city) => (
          <option key={city.value} value={city.value}>
            {city[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
