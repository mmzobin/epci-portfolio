/**
 * The app stores game times as the organizer's wall-clock (Israel) — a string
 * like "2026-06-20T18:30" parsed with `new Date(...)`, which on a UTC server is
 * stored as 18:30Z. Displays format that instant in UTC, so the user always sees
 * the time they typed.
 *
 * The one thing that must follow REAL Israel time is "has the game started /
 * expired" — and the server clock is UTC. `appNow()` returns a Date whose UTC
 * fields equal the current wall-clock in Israel, so comparing it against the
 * stored game time is correct (and DST-safe, via the tz database).
 *
 * We can't just set TZ=Asia/Jerusalem on Vercel — that env var name is reserved.
 */
const APP_TZ = "Asia/Jerusalem";

export function appNow(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value])) as Record<string, string>;
  const hour = p.hour === "24" ? "00" : p.hour;
  return new Date(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}Z`);
}
