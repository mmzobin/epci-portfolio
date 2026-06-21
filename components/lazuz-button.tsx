"use client";

import { openExternal } from "@/components/telegram-provider";
import { lazuzUrl } from "@/lib/lazuz";
import { useI18n } from "@/lib/i18n";

/**
 * Opens the Lazuz booking app/site. Inside Telegram this uses
 * Telegram.WebApp.openLink so the native Lazuz app can take over on mobile.
 */
export function LazuzButton({ url, className }: { url?: string | null; className?: string }) {
  const { t } = useI18n();
  const target = lazuzUrl(url);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => openExternal(target)}
        className={
          className ??
          "inline-flex w-full items-center justify-center gap-2 rounded-full bg-court px-4 py-3 text-sm font-black text-white shadow-premium-sm outline-none transition hover:bg-court-dark focus-visible:ring-2 focus-visible:ring-limeball/70"
        }
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 17L17 7M17 7H9M17 7V15"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t("lazuz.book")}
      </button>
      <p className="text-center text-xs text-ink/55">{t("lazuz.hint")}</p>
    </div>
  );
}
