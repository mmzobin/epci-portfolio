"use client";

import { useState } from "react";

/**
 * Tappable location that opens the address in a maps app. Telegram doesn't allow
 * triggering the native OS app-picker from a Mini App, so we show our own small
 * chooser (Google Maps / Waze / Apple Maps) as universal https links — the OS
 * routes each to the installed app. Uses Telegram.WebApp.openLink when present.
 */
const MAP_TARGETS = ["Google Maps", "Waze", "Apple Maps"] as const;

export function LocationMaps({ city, address, className = "" }: { city?: string; address: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const text = [city, address].filter(Boolean).join(" · ");
  const query = encodeURIComponent([address, city, "Israel"].filter(Boolean).join(", "));
  const urls: Record<(typeof MAP_TARGETS)[number], string> = {
    "Google Maps": `https://www.google.com/maps/search/?api=1&query=${query}`,
    Waze: `https://waze.com/ul?q=${query}`,
    "Apple Maps": `https://maps.apple.com/?q=${query}`
  };

  const go = (url: string) => {
    const tg = typeof window !== "undefined" ? (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp : undefined;
    if (tg?.openLink) tg.openLink(url);
    else if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
    setOpen(false);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-ink/62 outline-none transition hover:text-court"
        aria-expanded={open}
        data-testid="location-maps-toggle"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-court" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="2" />
        </svg>
        <span className="truncate">{text}</span>
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MAP_TARGETS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => go(urls[name])}
              className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink/70 transition hover:border-court/40 hover:text-court"
              data-testid={`map-open-${name}`}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
