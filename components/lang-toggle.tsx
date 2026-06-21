"use client";

import { useI18n, type Lang } from "@/lib/i18n";

const order: Lang[] = ["ru", "en"];

/** Compact RU/EN switch for the header. */
export function LangToggle() {
  const { lang, setLang } = useI18n();

  return (
    <div
      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 p-0.5 text-xs font-black"
      role="group"
      aria-label="Language"
    >
      {order.map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className={[
              "min-w-9 rounded-full px-2.5 py-1 uppercase tracking-wide outline-none transition",
              active
                ? "bg-limeball text-court-dark shadow-[0_4px_12px_rgba(156,255,26,0.35)]"
                : "text-white/70 hover:text-white"
            ].join(" ")}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
