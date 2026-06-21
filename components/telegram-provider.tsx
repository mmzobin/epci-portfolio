"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Minimal typings for the Telegram WebApp SDK we rely on. */
type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { user?: { id: number }; start_param?: string };
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: { impactOccurred?: (style: string) => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function applyTelegramTheme(wa: TelegramWebApp) {
  const root = document.documentElement;
  if (wa.colorScheme === "dark") {
    root.setAttribute("data-tg-theme", "dark");
  } else {
    root.setAttribute("data-tg-theme", "light");
  }
  // Match the Telegram window chrome to the app surface.
  wa.setHeaderColor?.("#07150d");
  wa.setBackgroundColor?.("#07150d");
}

/**
 * Boots the Telegram Mini App: runs ready()/expand(), applies the theme, and
 * silently signs the user in via initData when the app is opened inside Telegram.
 *
 * `authenticated` comes from the server (whether a padel_session already exists),
 * so we only run the login round-trip once per fresh launch.
 */
export function TelegramProvider({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [, setReady] = useState(false);
  const attempted = useRef(false);
  const routed = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function boot() {
      const wa = window.Telegram?.WebApp;
      if (!wa) return false;

      wa.ready();
      wa.expand();
      applyTelegramTheme(wa);
      setReady(true);

      // Deep-link routing: group buttons open the bot with ?startapp=<key>,
      // which arrives here as start_param. Navigate to the matching page.
      const startParam = wa.initDataUnsafe?.start_param;
      if (startParam && !routed.current) {
        routed.current = true;
        const routes: Record<string, string> = { ranking: "/ranking", tournaments: "/tournaments", games: "/#games" };
        const dest = routes[startParam];
        if (dest) router.push(dest);
      }

      if (!authenticated && wa.initData && !attempted.current) {
        attempted.current = true;
        void fetch("/api/telegram/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: wa.initData })
        })
          .then((res) => res.json())
          .then((data: { ok?: boolean; needsAssessment?: boolean }) => {
            if (cancelled) return;
            if (data?.ok) {
              if (data.needsAssessment) {
                router.push("/level-assessment");
              } else {
                router.refresh();
              }
            }
          })
          .catch(() => {
            /* outside Telegram or invalid initData — stay on the web flow */
          });
      }
      return true;
    }

    if (boot()) return;

    // SDK script may not be parsed yet; poll briefly.
    const interval = setInterval(() => {
      if (boot()) clearInterval(interval);
    }, 120);
    const timeout = setTimeout(() => clearInterval(interval), 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [authenticated, router]);

  return null;
}

/** Open an external link, preferring the in-Telegram handler when available. */
export function openExternal(url: string) {
  const wa = window.Telegram?.WebApp;
  if (wa?.openLink) {
    wa.openLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
