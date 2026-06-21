# Test Coverage Matrix — EPCI

A map of what the automated suite covers, by feature area and by test type.

**At a glance:** ~55 end-to-end scenarios across **10 spec files**, backed by
**11 page objects**, covering functional, negative, accessibility, responsive and
API checks. Strategy & CI details: [`docs/qa-strategy.md`](./qa-strategy.md).

---

## Coverage by area

| Area | Spec | Scenarios | Highlights |
|---|---|---:|---|
| Authentication & profile | `auth.spec.ts` | 4 | register + level assessment, login, password-recovery link, profile changes persist after re-login |
| Matchmaking | `matches.spec.ts` | 20 | join / waitlist / full, leave, waitlist promotion **with order preserved**, level-range gating, read-only states for cancelled/completed/expired |
| Organizer management | `organizer.spec.ts` | 15 | create / edit / complete / cancel lifecycle, price recalculation, mark paid/unpaid, no-show after settlement, level-range rules, permission gate |
| Admin | `admin.spec.ts` | 6 | manage clubs, create + complete a tournament, change roles & verify new permissions, validation & access gates |
| Ranking & player stats | `ranking.spec.ts` | 1 | rating leaderboard + player detail stats |
| Accessibility | `accessibility.spec.ts` | 4 | axe scan (no critical violations) on `/`, `/ranking`, `/login`, `/register` |
| API | `api.spec.ts` | 3 | level-assessment save (authed), unauthenticated reject, reset-token reject |
| Responsive | `responsive.spec.ts` | 1 | mobile (390×844) journey: login → match details → profile |
| Smoke (auth gates) | `smoke.spec.ts` | 1 | guest blocked from gated pages, can reach login/register |
| Production smoke | `prod-smoke.spec.ts` | 1 | read-only checks safe to run against the live deploy |

---

## Coverage by test type

| Area | Functional | Negative | Accessibility | Responsive | API | Smoke |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Authentication & profile | ✅ | ✅ | — | ✅* | ✅ | ✅ |
| Matchmaking | ✅ | ✅ | — | ✅* | — | — |
| Organizer management | ✅ | ✅ | — | — | — | — |
| Admin | ✅ | ✅ | — | — | — | — |
| Ranking | ✅ | — | ✅ | — | — | ✅ |
| Accessibility | — | — | ✅ | — | — | — |
| Reset endpoint | — | ✅ | — | — | ✅ | — |

\* Responsive coverage exercises auth, match details and profile on a mobile viewport.

---

## Notable scenarios (depth)

**Matchmaking** — beyond the happy path:
- waitlisted player is promoted when a participant leaves, **and queue order is preserved** (`[regression]`);
- join blocked when the player's rating is outside the game's level range;
- cancelled / completed / expired games are read-only and not joinable via deep link;
- card states differ correctly for guest vs joined vs host vs full.

**Organizer lifecycle** — state-machine correctness:
- a game can be completed only in valid states (expired/played), not future ones;
- completed games can't be reopened or cancelled; cancelled can't be completed;
- no-show can only be marked after the game can be settled;
- editing the club recalculates the per-player price.

**Negative / security gates:**
- non-organizer can't open organizer management; non-admin can't open admin pages;
- tournament results reject impossible scores (wins > matches played);
- `POST /api/level-assessment` rejects unauthenticated requests;
- `POST /api/test/reset` rejects an invalid reset token.

---

## Tags

| Tag | Meaning | Where it runs |
|---|---|---|
| `@smoke` | fast critical-path checks (reset fixture) | PR / staging |
| `@prod-smoke` | read-only checks safe for production | post-deploy |
| `[functional]` / `[negative]` / `[regression]` / `[api]` / `[responsive]` | scenario classification in titles | all runs |

Planned tag taxonomy (`@regression`, `@a11y`, `@mobile`, `@destructive`) is tracked
in [`docs/qa-strategy.md`](./qa-strategy.md) → *Known Follow-Ups*.
