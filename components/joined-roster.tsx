import { addGuestAction, removeGuestAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PlayerAvatar } from "@/components/player-avatar";
import { cityLabel } from "@/lib/cities";
import { MAX_GUESTS_PER_MEMBER } from "@/lib/games";
import type { Lang } from "@/lib/dictionaries";

type Participant = {
  id: string;
  user: { id: string; name: string; lastName: string; photoUrl: string | null; level: number; city: string | null };
};
type Guest = { id: string; name: string | null; invitedById: string };

/** Joined roster with guests grouped under the member who invited them (up to
 * MAX_GUESTS_PER_MEMBER). The current user can add/remove their own guests; an
 * organizer/admin can remove any. Guests count toward the line-up. */
export function JoinedRoster({
  gameId,
  title,
  emptyMessage,
  noCity,
  participants,
  guests,
  currentUserId,
  canManage,
  slotsLeft,
  lang
}: {
  gameId: string;
  title: string;
  emptyMessage: string;
  noCity: string;
  participants: Participant[];
  guests: Guest[];
  currentUserId: string;
  canManage: boolean;
  slotsLeft: number;
  lang: Lang;
}) {
  const ru = lang === "ru";
  const byInviter = new Map<string, Guest[]>();
  for (const g of guests) {
    const arr = byInviter.get(g.invitedById) ?? [];
    arr.push(g);
    byInviter.set(g.invitedById, arr);
  }

  return (
    <div className="epci-card">
      <h2 className="font-black">{title}</h2>
      <div className="mt-3 space-y-2">
        {participants.length ? (
          participants.map((p) => {
            const mine = byInviter.get(p.user.id) ?? [];
            const isMe = p.user.id === currentUserId;
            const canAdd = isMe && mine.length < MAX_GUESTS_PER_MEMBER && slotsLeft > 0;
            return (
              <div key={p.id} className="epci-mini-surface p-2.5" data-testid={`roster-player-${p.user.name}`}>
                <div className="flex items-center gap-3">
                  <PlayerAvatar photoUrl={p.user.photoUrl} name={p.user.name} lastName={p.user.lastName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">
                      {p.user.name} {p.user.lastName}
                      {isMe ? <span className="ml-1 text-xs font-bold text-court">· {ru ? "ты" : "you"}</span> : null}
                    </p>
                    <p className="text-xs text-ink/55">{p.user.level.toFixed(1)} · {cityLabel(p.user.city, lang) || noCity}</p>
                  </div>
                  {mine.length ? (
                    <span className="rounded-md bg-court-soft px-2 py-0.5 text-[0.65rem] font-black text-court">+{mine.length} {ru ? "гость" : "guest"}</span>
                  ) : null}
                </div>

                {mine.length || canAdd ? (
                  <div className="ml-2 mt-2 space-y-1.5 border-l-2 border-line pl-3">
                    {mine.map((g) => (
                      <div key={g.id} className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-court/30 text-court">
                          <GuestIcon />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">
                          {g.name || (ru ? "Гость" : "Guest")}{" "}
                          <span className="rounded bg-court-soft px-1.5 py-0.5 text-[0.58rem] font-black text-court">{ru ? "ГОСТЬ" : "GUEST"}</span>
                        </span>
                        {isMe || canManage ? (
                          <form action={removeGuestAction}>
                            <input type="hidden" name="gameId" value={gameId} />
                            <input type="hidden" name="guestId" value={g.id} />
                            <button type="submit" className="p-1 text-xs text-ink/40 transition hover:text-red-600" aria-label={ru ? "Убрать гостя" : "Remove guest"}>✕</button>
                          </form>
                        ) : null}
                      </div>
                    ))}
                    {canAdd ? (
                      <form action={addGuestAction} className="flex items-center gap-1.5 pt-0.5" data-testid="add-guest-form">
                        <input type="hidden" name="gameId" value={gameId} />
                        <input
                          name="name"
                          maxLength={40}
                          placeholder={ru ? "Имя гостя (необязательно)" : "Guest name (optional)"}
                          className="epci-field h-9 flex-1 text-xs"
                        />
                        <button type="submit" className="epci-btn-secondary shrink-0 px-3 py-1.5 text-xs" data-testid="add-guest-submit">
                          + {ru ? "гость" : "guest"} {mine.length + 1}/{MAX_GUESTS_PER_MEMBER}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <EmptyState message={emptyMessage} className="min-h-20" />
        )}
      </div>
    </div>
  );
}

function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
