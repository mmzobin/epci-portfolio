/**
 * Lazuz is the third-party (monopoly) court-booking app used in central Israel.
 * There is no public Lazuz API, so we deep-link out to it: on mobile the
 * universal link opens the Lazuz app if installed, otherwise the web/app store.
 *
 * Per-club booking links can be passed explicitly; otherwise we fall back to the
 * configurable default (NEXT_PUBLIC_LAZUZ_URL) or the Lazuz home.
 */
export const DEFAULT_LAZUZ_URL = process.env.NEXT_PUBLIC_LAZUZ_URL || "https://lazuz.co.il/";

export function lazuzUrl(clubUrl?: string | null): string {
  const url = (clubUrl && clubUrl.trim()) || DEFAULT_LAZUZ_URL;
  return url;
}
