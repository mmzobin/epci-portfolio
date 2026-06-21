export const playerLevels = [
  { value: 1.0, label: "1.0 - Complete beginner" },
  { value: 1.5, label: "1.5 - Beginner" },
  { value: 2.0, label: "2.0 - Beginner+" },
  { value: 2.5, label: "2.5 - Strong beginner / Improver" },
  { value: 3.0, label: "3.0 - Low intermediate" },
  { value: 3.5, label: "3.5 - Intermediate" },
  { value: 4.0, label: "4.0 - Strong intermediate" },
  { value: 4.5, label: "4.5 - Advanced amateur" },
  { value: 5.0, label: "5.0 - Competitive advanced" },
  { value: 5.5, label: "5.5 - Club elite / coach level" },
  { value: 6.0, label: "6.0 - National level" },
  { value: 6.5, label: "6.5 - Semi-pro" },
  { value: 7.0, label: "7.0 - Professional" }
];

/** Single source of truth for a player's rating: the live ELO if they have one,
 * otherwise their assessment level (seed). */
export function effectiveRating(user: { skillRating?: number | null; level: number }) {
  return user.skillRating ?? user.level;
}

// Letter bands (matching the self-rating in the assessment), split at the
// midpoints between the D…A anchors.
const BAND_BREAKS: [number, string][] = [
  [1.875, "D"],
  [2.625, "D+"],
  [3.375, "C"],
  [4.125, "C+"],
  [4.875, "B"],
  [5.625, "B+"]
];

/** Map a numeric rating (1–7) to a letter band D / D+ / C / C+ / B / B+ / A. */
export function ratingToBand(rating: number) {
  for (const [max, band] of BAND_BREAKS) {
    if (rating < max) return band;
  }
  return "A";
}

export function formatLevelRange(min: number, max: number) {
  return `${min.toFixed(1)}-${max.toFixed(1)}`;
}

export function isLevelInRange(level: number, min: number, max: number) {
  return level >= min && level <= max;
}

export function levelRangeErrorMessage(level: number, min: number, max: number) {
  return `Your level ${level.toFixed(1)} doesn't match this game's required level range: ${formatLevelRange(min, max)}.`;
}

export function levelMismatchMessage(level: number, min: number, max: number) {
  return `Your current level is ${level.toFixed(1)}. This game requires players between ${min.toFixed(1)} and ${max.toFixed(1)}.`;
}
