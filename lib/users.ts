import { Prisma } from "@prisma/client";

/**
 * Excludes hidden/system accounts (e.g. the "Padel Admin" service user) from
 * player-facing lists: ranking, player pickers, partner selection. Spread into a
 * `where` clause: `{ ...other, ...HIDDEN_USER_FILTER }`.
 *
 * `hidden` isn't in the sandbox Prisma client yet; the cast is resolved by
 * `prisma generate` on a machine with network access.
 */
export const HIDDEN_USER_FILTER = { hidden: false } as Prisma.UserWhereInput;
