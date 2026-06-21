"use client";

import { useState } from "react";
import { cityCrest } from "@/lib/city-crests";
import { cityLabel } from "@/lib/cities";
import { useI18n } from "@/lib/i18n";

/**
 * Player location chip: city coat-of-arms when the image exists, otherwise a
 * clean pin icon + localized city name. Renders nothing when no city is set.
 */
export function CityLocation({
  city,
  className = "",
  tone = "light"
}: {
  city: string | null | undefined;
  className?: string;
  tone?: "light" | "dark";
}) {
  const { lang } = useI18n();
  const [crestFailed, setCrestFailed] = useState(false);

  if (!city || !city.trim()) return null;
  const crest = cityCrest(city);
  const color = tone === "dark" ? "text-white/70" : "text-ink/55";
  const label = cityLabel(city, lang);

  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${color} ${className}`}>
      {crest && !crestFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} alt="" className="h-4 w-4 shrink-0 object-contain" onError={() => setCrestFailed(true)} />
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
