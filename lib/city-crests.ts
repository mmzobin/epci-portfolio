import { citySlug } from "@/lib/cities";

/**
 * Coat-of-arms (герб) path for a city, or null if unknown.
 * Add the image at public/crests/<slug>.png — CityLocation falls back to a pin
 * icon (via onError) until the file exists, so missing crests never 404 visibly.
 */
export function cityCrest(city: string | null | undefined): string | null {
  const slug = citySlug(city);
  return slug ? `/crests/${slug}.png` : null;
}
