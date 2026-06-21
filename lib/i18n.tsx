"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dictionaries, LANG_COOKIE, translate, type DictKey, type Lang } from "@/lib/dictionaries";

export type { Lang } from "@/lib/dictionaries";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: DictKey) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

function readCookieLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value === "ru" || value === "en" ? value : null;
}

function detectInitialLang(): Lang {
  const cookieLang = readCookieLang();
  if (cookieLang) return cookieLang;
  // Default is English; only fall back to Russian when the browser/Telegram
  // language is explicitly Russian.
  if (typeof window !== "undefined") {
    const wa = window.Telegram?.WebApp as unknown as { initDataUnsafe?: { user?: { language_code?: string } } } | undefined;
    const code = (wa?.initDataUnsafe?.user?.language_code ?? navigator.language ?? "").toLowerCase();
    if (code.startsWith("ru")) return "ru";
  }
  return "en";
}

export function LangProvider({ initialLang = "en", children }: { initialLang?: Lang; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    if (readCookieLang()) return; // user already has a saved language; server matches it
    const detected = detectInitialLang();
    document.cookie = `${LANG_COOKIE}=${detected}; path=/; max-age=31536000; samesite=lax`;
    if (detected !== initialLang) {
      // The browser language differs from what the server rendered: switch and
      // re-render server components so the whole page matches (no RU/EN mismatch).
      setLangState(detected);
      try {
        document.documentElement.lang = detected;
      } catch {
        /* ignore */
      }
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = next;
      } catch {
        /* ignore */
      }
      // Re-render server components in the new language.
      router.refresh();
    },
    [router]
  );

  const t = useCallback((key: DictKey) => translate(lang, key), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    return {
      lang: "en" as Lang,
      setLang: () => undefined,
      t: (key: DictKey) => dictionaries.en[key] ?? String(key)
    };
  }
  return ctx;
}
