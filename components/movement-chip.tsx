/**
 * Weekly rank movement indicator: green ▲ when a player moved up, red ▼ when down.
 * Renders nothing when there is no change or no prior data.
 */
export function MovementChip({ movement, className = "" }: { movement: number | null; className?: string }) {
  if (movement == null || movement === 0) return null;
  const up = movement > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[0.7rem] font-black leading-none ${
        up ? "bg-court-soft text-court" : "bg-red-50 text-red-600"
      } ${className}`}
      title={up ? `Up ${movement}` : `Down ${Math.abs(movement)}`}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(movement)}
    </span>
  );
}
