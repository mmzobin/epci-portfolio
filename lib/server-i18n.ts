import { cookies } from "next/headers";
import { dictionaries, LANG_COOKIE, translate, type DictKey, type Lang } from "@/lib/dictionaries";

/** Read the UI language from the cookie set by the client toggle (default en). */
export function getLang(): Lang {
  const value = cookies().get(LANG_COOKIE)?.value;
  return value === "ru" ? "ru" : "en";
}

/** Server-side translator bound to the current request language. */
export function getT(): { lang: Lang; t: (key: DictKey) => string } {
  const lang = getLang();
  return { lang, t: (key: DictKey) => translate(lang, key) };
}

export { dictionaries };
