type PlayerAvatarSize = "sm" | "md" | "lg";

const sizes: Record<PlayerAvatarSize, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-20 w-20 text-xl"
};

export function PlayerAvatar({
  photoUrl,
  name,
  lastName,
  size = "md"
}: {
  photoUrl: string | null;
  name: string;
  lastName: string;
  size?: PlayerAvatarSize;
}) {
  const initials = `${name[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const className = `${sizes[size]} shrink-0 rounded-full border border-white object-cover shadow-[0_8px_18px_rgba(7,21,13,0.12)] ring-1 ring-line`;

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={`${name} ${lastName}`} className={className} />
    );
  }

  return (
    <div className={`flex ${className} items-center justify-center bg-court-dark font-black text-limeball`} aria-hidden="true">
      {initials}
    </div>
  );
}
