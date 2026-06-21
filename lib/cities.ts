/**
 * Canonical list of Israeli cities used for the profile city picker.
 *
 * `value` is the stored canonical string (English). `ru`/`en` are display labels.
 * `slug` maps to a coat-of-arms image at /public/crests/<slug>.png.
 *
 * Because the city is now a controlled select (not free text), every value maps
 * cleanly to one crest — just drop the PNGs into public/crests/.
 */
export type CityOption = { value: string; ru: string; en: string; slug: string };

export const ISRAELI_CITIES: CityOption[] = [
  { value: "Tel Aviv", ru: "Тель-Авив", en: "Tel Aviv", slug: "tel-aviv" },
  { value: "Holon", ru: "Холон", en: "Holon", slug: "holon" },
  { value: "Bat Yam", ru: "Бат-Ям", en: "Bat Yam", slug: "bat-yam" },
  { value: "Ramat Gan", ru: "Рамат-Ган", en: "Ramat Gan", slug: "ramat-gan" },
  { value: "Givatayim", ru: "Гиватаим", en: "Givatayim", slug: "givatayim" },
  { value: "Rishon LeZion", ru: "Ришон-ле-Цион", en: "Rishon LeZion", slug: "rishon-lezion" },
  { value: "Petah Tikva", ru: "Петах-Тиква", en: "Petah Tikva", slug: "petah-tikva" },
  { value: "Herzliya", ru: "Герцлия", en: "Herzliya", slug: "herzliya" },
  { value: "Raanana", ru: "Раанана", en: "Ra'anana", slug: "raanana" },
  { value: "Kfar Saba", ru: "Кфар-Саба", en: "Kfar Saba", slug: "kfar-saba" },
  { value: "Hod HaSharon", ru: "Ход-ха-Шарон", en: "Hod HaSharon", slug: "hod-hasharon" },
  { value: "Ramat HaSharon", ru: "Рамат-ха-Шарон", en: "Ramat HaSharon", slug: "ramat-hasharon" },
  { value: "Netanya", ru: "Нетания", en: "Netanya", slug: "netanya" },
  { value: "Rehovot", ru: "Реховот", en: "Rehovot", slug: "rehovot" },
  { value: "Ness Ziona", ru: "Нес-Циона", en: "Ness Ziona", slug: "ness-ziona" },
  { value: "Modiin", ru: "Модиин", en: "Modiin", slug: "modiin" },
  { value: "Jerusalem", ru: "Иерусалим", en: "Jerusalem", slug: "jerusalem" },
  { value: "Haifa", ru: "Хайфа", en: "Haifa", slug: "haifa" },
  { value: "Ashdod", ru: "Ашдод", en: "Ashdod", slug: "ashdod" },
  { value: "Ashkelon", ru: "Ашкелон", en: "Ashkelon", slug: "ashkelon" },
  { value: "Beer Sheva", ru: "Беэр-Шева", en: "Beer Sheva", slug: "beer-sheva" },
  { value: "Eilat", ru: "Эйлат", en: "Eilat", slug: "eilat" },
  { value: "Be'er Yakov", ru: "Беэр-Яков", en: "Be'er Yakov", slug: "beer-yakov" },
  { value: "Givat Shmuel", ru: "Гиват-Шмуэль", en: "Givat Shmuel", slug: "givat-shmuel" },
  { value: "Kiryat Ono", ru: "Кирьят-Оно", en: "Kiryat Ono", slug: "kiryat-ono" },
  { value: "Lod", ru: "Лод", en: "Lod", slug: "lod" },
  { value: "Ramla", ru: "Рамла", en: "Ramla", slug: "ramla" },
  { value: "Yavne", ru: "Явне", en: "Yavne", slug: "yavne" },
  { value: "Bnei Brak", ru: "Бней-Брак", en: "Bnei Brak", slug: "bnei-brak" }
];

const slugByName: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const city of ISRAELI_CITIES) {
    map[city.value.toLowerCase()] = city.slug;
    map[city.ru.toLowerCase()] = city.slug;
    map[city.en.toLowerCase()] = city.slug;
  }
  return map;
})();

/** Resolve a (possibly legacy free-text) city to its crest slug, if known. */
export function citySlug(city: string | null | undefined): string | null {
  if (!city) return null;
  return slugByName[city.trim().toLowerCase()] ?? null;
}

/** Localized label for a stored city value (falls back to the raw value). */
export function cityLabel(city: string | null | undefined, lang: "ru" | "en"): string {
  if (!city) return "";
  const match = ISRAELI_CITIES.find(
    (c) => c.value.toLowerCase() === city.trim().toLowerCase() || c.ru.toLowerCase() === city.trim().toLowerCase() || c.en.toLowerCase() === city.trim().toLowerCase()
  );
  return match ? match[lang] : city;
}
