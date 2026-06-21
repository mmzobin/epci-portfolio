/** Compact Israel flag for player location chips. */
export function IsraelFlag({ className = "h-3.5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} shrink-0 rounded-[2px] ring-1 ring-black/10`} aria-label="Israel" role="img">
      <rect width="30" height="20" fill="#fff" />
      <rect y="3" width="30" height="2.4" fill="#0038b8" />
      <rect y="14.6" width="30" height="2.4" fill="#0038b8" />
      <g fill="none" stroke="#0038b8" strokeWidth="0.9">
        <path d="M15 7 L17.6 11.5 L12.4 11.5 Z" />
        <path d="M15 13 L12.4 8.5 L17.6 8.5 Z" />
      </g>
    </svg>
  );
}
