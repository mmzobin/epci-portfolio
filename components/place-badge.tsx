const medalStyles: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-zinc-300 text-zinc-800",
  3: "bg-orange-300 text-orange-950"
};

export function PlaceBadge({ place, testId }: { place: number; testId?: string }) {
  const medal = medalStyles[place];

  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${medal ?? "border border-line text-ink/50"}`}
      data-testid={testId}
      title={`Place ${place}`}
    >
      {place}
    </span>
  );
}

const rankMedal: Record<number, { grad: string; ring: string; text: string }> = {
  1: { grad: "from-amber-300 to-amber-500", ring: "ring-amber-200", text: "text-amber-950" },
  2: { grad: "from-zinc-200 to-zinc-400", ring: "ring-zinc-100", text: "text-zinc-800" },
  3: { grad: "from-orange-300 to-orange-500", ring: "ring-orange-200", text: "text-orange-950" }
};

/**
 * Ranking position badge. Top-3 get a metallic medal with a trophy accent;
 * everyone else gets a clean court-soft circle.
 */
export function RankMedal({ place, size = "md" }: { place: number; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-8 w-8 text-sm" : "h-11 w-11 text-base";
  const medal = rankMedal[place];

  if (!medal) {
    return (
      <span className={`flex ${dims} shrink-0 items-center justify-center rounded-full bg-court-soft font-black text-court`} title={`Place ${place}`}>
        {place}
      </span>
    );
  }

  return (
    <span
      className={`relative flex ${dims} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${medal.grad} font-black ${medal.text} shadow-[0_6px_16px_rgba(0,0,0,0.20)] ring-2 ${medal.ring}`}
      title={`Place ${place}`}
    >
      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/5">
        <TrophyIcon className={`h-2.5 w-2.5 ${medal.text}`} />
      </span>
      {place}
    </span>
  );
}

const brightRank: Record<number, { bg: string; color: string; shadow: string }> = {
  1: { bg: "#f0b429", color: "#4a3500", shadow: "0 5px 16px rgba(240,180,41,0.45)" },
  2: { bg: "#c2cad3", color: "#2f3640", shadow: "0 5px 16px rgba(160,170,180,0.4)" },
  3: { bg: "#cf8a4a", color: "#ffffff", shadow: "0 5px 16px rgba(207,138,74,0.45)" }
};

/** Bright, modern rank badge for the leaderboard: top-3 get a glowing gold /
 * silver / bronze tile, everyone else a calm court-soft tile. */
export function RankBadge({ place }: { place: number | null }) {
  if (place == null) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink/[0.04] text-base font-black text-ink/30">–</span>
    );
  }
  const top = brightRank[place];
  if (top) {
    return (
      <span
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl font-black"
        style={{ background: top.bg, color: top.color, boxShadow: top.shadow }}
        title={`Place ${place}`}
      >
        {place}
        {place === 1 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/5">
            <TrophyIcon className="h-2.5 w-2.5 text-amber-600" />
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-court-soft text-lg font-black text-court" title={`Place ${place}`}>
      {place}
    </span>
  );
}

export function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3M17 6h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" />
    </svg>
  );
}
