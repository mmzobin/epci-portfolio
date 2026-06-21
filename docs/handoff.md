# EPCI Padel Community MVP - Handoff

Last updated: 2026-06-07

## Project

Workspace path:

```bash
/Users/zobin/Documents/New project/padel-community
```

Local app:

```bash
http://localhost:3000
```

Stack:

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- Prisma ORM
- SQLite SQL database for local MVP
- Server Actions and API routes
- Playwright E2E

## Product Scope

MVP for Exclusive Padel Crew Israel, a Russian-speaking padel community in Israel.

Current MVP supports:

- Registration and login with local email/password auth.
- HttpOnly cookie session.
- Player level assessment questionnaire after registration.
- Game cards and game detail pages.
- Join game, leave game, waitlist.
- Automatic promotion from waitlist when a joined player leaves.
- Player profile and game history.
- Organizer panel for games and participants.
- Manual payment marking.
- No-show marking.
- Admin user role management.

Out of scope for now:

- Email confirmation.
- Supabase Auth.
- Resend SMTP.
- Telegram bot.
- Payments / Bit / Lazuz integration.
- Tournaments.
- Ratings.
- Subscriptions.

## Important Accounts

All seeded users use:

```text
Password123!
```

Admin owner:

```text
mmzobin@gmail.com
```

Other seeded users:

```text
admin@padel.test
jan@padel.test
boris@padel.test
nastya@padel.test
sasha@padel.test
efim@padel.test
anton@padel.test
diana@padel.test
```

## Roles

Roles are stored as strings in `User.role`:

- `PLAYER`: can join/leave games and view profile/history.
- `ORGANIZER`: can create, edit, cancel, complete games, manage participants, payment, no-show.
- `ADMIN`: full access, including role management.

Admin UI:

```text
/admin/users
```

The nav shows `Админ` only for `ADMIN`.

## Registration

Registration fields:

- `name` required
- `lastName` required
- `email` required
- `password` required
- `phone` optional
- `telegramUsername` optional
- `city` optional

After registration, user is redirected to:

```text
/level-assessment
```

Email confirmation is not implemented. Current registration creates a local Prisma user immediately.

## Level Assessment

The level assessment was changed to a server-rendered flow to avoid a Next.js dev runtime issue:

```text
TypeError: __webpack_require__.n is not a function
```

Current flow:

1. `/level-assessment` renders a plain server HTML form.
2. Submitting goes to `/level-assessment/result` with query params.
3. Result page calculates score and displays level.
4. `Save level` calls server action in `app/level-assessment/actions.ts`.
5. User is redirected to `/profile`.

Important files:

- `components/level-assessment-form.tsx`
- `app/level-assessment/page.tsx`
- `app/level-assessment/result/page.tsx`
- `app/level-assessment/actions.ts`
- `lib/level-assessment.ts`

Retake rule:

- Previously limited to once per 30 days.
- Now intentionally always allowed.
- `canRetakeAssessment()` returns `true`.

## Branding

Brand name:

```text
Exclusive Padel Crew Israel
```

Slogan:

```text
Эксклюзивное сообщество любителей падела в Израиле
```

Current icon:

```text
public/brand/epci-icon.png
```

The current logo is the minimalist monochrome “02” EPCI concept with subtle padel perforation in the `P`.

## Database

Prisma schema:

```text
prisma/schema.prisma
```

Migrations:

```text
prisma/migrations/20260607120000_init/migration.sql
prisma/migrations/20260607143000_level_assessment/migration.sql
prisma/migrations/20260607170000_user_profile_admin/migration.sql
```

Seed:

```text
prisma/seed.ts
```

Reset DB:

```bash
npx prisma migrate reset --force
```

## Useful Commands

Install:

```bash
npm install
```

Run app:

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

E2E tests:

```bash
npm run test:e2e
```

If old dev servers cause port/cache issues:

```bash
pkill -f "next dev"
rm -rf .next
npm run dev
```

## Verification Status

Latest successful checks:

```text
npx prisma migrate reset --force
npm run typecheck
npm run build
npm run test:e2e
```

Latest Playwright status:

```text
12 passed
```

## Current Architecture Notes

Auth:

- Local email/password auth, not Supabase.
- Passwords are hashed with bcryptjs.
- Session cookie stores user id.
- Auth helpers are in `lib/auth.ts`.

Game business logic:

- `lib/games.ts`
- Handles join/leave/waitlist promotion/status sync.

Admin role management:

- `app/admin/users/page.tsx`
- `app/admin/actions.ts`

## Open Product Ideas

Likely next useful work:

1. Add approval flow for Telegram community members:
   - `User.status`: `PENDING`, `APPROVED`, `BLOCKED`
   - Admin approves new registrations.
2. Add admin invite links or invite codes for a closed community.
3. Add password reset.
4. Later, replace local auth with Supabase Auth if needed.
5. If using Supabase Auth in production, configure Resend as custom SMTP rather than relying on Supabase default email provider.
6. Add game filters by city, level, date.
7. Add organizer notes and participant comments.
8. Add mobile polish for admin tables.

## New Chat Startup Prompt

Use this in a new context window:

```text
We are working on /Users/zobin/Documents/New project/padel-community.
Read docs/handoff.md first, then continue from the current state.
Do not restart the project from scratch.
Run checks after changes: npm run typecheck, npm run build, npm run test:e2e when relevant.
```
