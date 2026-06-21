# Architecture

## Current App Structure

This is a Next.js App Router application using TypeScript, Tailwind CSS, Prisma, and a local SQLite database for the MVP.

- `app/` contains route segments, pages, server actions, API routes, and the root layout.
- `components/` contains shared UI components such as game cards, game forms, and the level assessment form.
- `lib/` contains domain helpers for auth, games, levels, level assessment, Prisma access, and status constants.
- `prisma/` contains the schema, migrations, seed data, and local development database.
- `tests/` contains Playwright end-to-end tests.
- `docs/` contains handoff notes.

## Auth Flow

Authentication is local email/password auth.

- Registration is handled by `registerAction` in `app/actions.ts`.
- Passwords are hashed with `bcryptjs`.
- Sessions are stored in an HttpOnly cookie named `padel_session`.
- `getCurrentUser()` reads the cookie and loads the selected user fields from Prisma.
- `requireUser()`, `requireOrganizer()`, and `requireAdmin()` protect authenticated, organizer, and admin routes.
- New registrations are assigned level `1.0` and redirected to `/level-assessment`.
- Login redirects users without a saved level assessment date to `/level-assessment`.

Password recovery is a hybrid flow that keeps the local auth system intact.

- `/forgot-password` sends reset emails through Supabase Auth using `resetPasswordForEmail()`.
- If `SUPABASE_SERVICE_ROLE_KEY` is configured, the server action first ensures that a matching Supabase Auth user exists for the local Prisma email.
- Supabase redirects users back to `/reset-password`.
- `/reset-password` uses the Supabase recovery session to call `updateUser({ password })`.
- After Supabase confirms the recovery session, the app verifies the access token with `getUser(token)` and updates the matching local Prisma `User.passwordHash`.
- Registration, login, and the existing HttpOnly cookie session remain local and unchanged.
- Without `SUPABASE_SERVICE_ROLE_KEY`, Supabase users must already exist with the same email as local Prisma users for reset emails to be sent.

## User Roles

Roles are string constants in `lib/statuses.ts` and stored in `User.role`.

- `PLAYER`: can authenticate, view profile/history, join games, and leave games.
- `ORGANIZER`: can access organizer routes, create/edit games, change game status, and manage participant status/payment.
- `ADMIN`: can do organizer actions and manage user roles at `/admin/users`.

## Game Creation Flow

Organizers create games at `/organizer/games/new` using `GameForm`.

Current form fields:

- title
- date/time
- city
- club
- address
- courts
- max players
- price per player
- minimum level
- maximum level

The server action validates input with Zod in `app/actions.ts`, creates the game through `createGame()` in `lib/games.ts`, and redirects to the organizer game management page.

Current implementation notes:

- `city`, `club`, and `address` are free-text fields.
- `courts` is currently an integer field.
- There is not yet a central `Club` table.
- Address and price are not yet auto-filled from club data.
- The product requirement is one game = one court; the current schema still names the field `courts`.

## Level System

The level assessment lives in `lib/level-assessment.ts` and is rendered through `/level-assessment`.

- Assessment questions are in Russian.
- Each option contributes points.
- `levelFromScore()` converts score to a level from `1.0` through `5.0`.
- Saving an assessment updates `User.level`, `User.levelAssessmentScore`, and `User.levelAssessmentDate`.
- `playerLevels` in `lib/levels.ts` defines selectable game level boundaries from `1.0` through `7.0`.

Current limitation:

- Game join logic currently handles status, capacity, and waitlist, but does not yet enforce that the player's level is inside the game's `minLevel`/`maxLevel` range.

## Database Tables

Current Prisma models:

- `User`: identity, contact fields, city, level, assessment metadata, role, game counters, cancellation/no-show counters, organized games, and participations.
- `Game`: title, start time, city, club, address, court count, max players, price per player, level range, organizer, status, timestamps, and participations.
- `Participation`: user/game membership with status, payment status, timestamps, and a unique `(userId, gameId)` constraint.

Current status constants:

- Game statuses: `DRAFT`, `OPEN`, `FULL`, `CANCELLED`, `COMPLETED`.
- Participation statuses: `REQUESTED`, `JOINED`, `WAITING`, `CANCELLED`, `PLAYED`, `NO_SHOW`.
- Payment statuses: `PAID`, `UNPAID`.

Missing planned tables:

- `Club` for central club data.
- Dedicated rating/matchmaking tables are not implemented yet.

## Main Pages and Components

Pages:

- `/`: public home page with game list.
- `/login`: login page.
- `/forgot-password`: password recovery email request page.
- `/reset-password`: new password page reached from a Supabase Auth recovery link.
- `/register`: registration page.
- `/games/[id]`: game detail, roster, waitlist, join, and leave.
- `/profile`: player profile, level assessment status, metrics, and game history.
- `/level-assessment`: level questionnaire.
- `/level-assessment/result`: calculated assessment result and save action.
- `/organizer`: organizer game dashboard.
- `/organizer/games/new`: create game.
- `/organizer/games/[id]`: edit game, manage status, participants, payment, no-shows, and waitlist.
- `/admin/users`: admin role management.

Components:

- `components/game-card.tsx`: game summary card.
- `components/game-form.tsx`: create/edit game form.
- `components/level-assessment-form.tsx`: level assessment questionnaire form.

API routes:

- `app/api/level-assessment/route.ts`: level assessment API helper.
- `app/api/test/reset/route.ts`: local test database reset endpoint.
