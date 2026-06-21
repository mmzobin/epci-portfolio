# EPCI — Padel Community Platform 🎾

A full‑stack community app for an amateur padel crew, running as a **Telegram Mini App**.
Players schedule games, fill line‑ups, track a live skill rating, and run small tournaments —
all inside Telegram, with a bilingual (RU/EN) interface.

> **Live demo:** <live-demo-url>
> Built end‑to‑end (product, frontend, backend, database and **E2E tests**) by [@<your-github>](https://github.com/<your-github>).

[![E2E](https://github.com/<your-github>/<repo>/actions/workflows/e2e.yml/badge.svg)](https://github.com/<your-github>/<repo>/actions/workflows/e2e.yml)
[![Nightly E2E](https://github.com/<your-github>/<repo>/actions/workflows/nightly-e2e.yml/badge.svg)](https://github.com/<your-github>/<repo>/actions/workflows/nightly-e2e.yml)
[![Test report](https://img.shields.io/badge/test%20report-live-2ea44f)](https://<your-github>.github.io/<repo>/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

📊 **Live Playwright report:** https://<your-github>.github.io/<repo>/ · 🧪 **Test strategy:** [`docs/qa-strategy.md`](docs/qa-strategy.md) · [coverage matrix](docs/test-coverage.md)

<!-- Add 2–4 screenshots here, e.g.: -->
<!-- ![Games list](docs/screenshots/games.png) -->
<!-- ![Rating leaderboard](docs/screenshots/rating.png) -->
<!-- ![Match scorecard](docs/screenshots/match.png) -->

---

## What it does

- **Game scheduling** — create games, join, waitlists, member "+1" guests, and a level‑based eligibility filter.
- **Court‑booking hand‑off** — deep‑links to the club's booking system (Lazuz) and tracks "court booked".
- **Skill rating (ELO‑style)** — ranked casual matches update a per‑player rating with a provisional period for new players; results are confirmed by all participants before they count.
- **Level‑assessment survey** — a weighted questionnaire that seeds a player's starting rating, with anti‑inflation safeguards.
- **Tournaments** — Americano and fixed‑pairs formats with automatic pairing and results.
- **Live leaderboard** — ranking by game rating with weekly movement.
- **Telegram notifications** — targeted DMs (game filled, court booked) and group announcements, designed to minimise spam.
- **Roles & i18n** — admin / organizer / player roles, full RU/EN localisation.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, Server Actions) |
| Language | TypeScript |
| Database | PostgreSQL (Supabase) via Prisma ORM |
| Styling | Tailwind CSS |
| Platform | Telegram Mini App + responsive web |
| Hosting | Vercel |
| Testing | Playwright (end‑to‑end) |

## Testing — the part I focused on

End‑to‑end coverage with **Playwright**, structured for maintainability:

- **Page Object Model** — UI interactions live in page objects (`tests/pages/`), so specs read like user stories and selectors change in one place.
- **Isolated fixtures** — deterministic seed data (`tests/data/`) and a guarded test‑database reset, so runs are repeatable and never touch production.
- **CI-safe parallelism** — Playwright shards run in separate GitHub Actions jobs, each with its own PostgreSQL service, so reset-based tests never share mutable state.
- **Nightly and post-deploy coverage** — full regression runs nightly on isolated test databases, while production deploys run a read-only smoke suite with no reset, seed or migrations.
- **Realistic flows covered** — registration + level assessment, authentication, matchmaking (join / waitlist / full), organizer management (create, edit, complete, cancel, mark paid / no‑show), rating eligibility, and responsive layouts across devices.
- **Negative & edge cases** — e.g. joining an expired game, completing the wrong status, level‑range mismatches, duplicate players in a ranked round.

Run the suite:

```bash
npm install
npx playwright install --with-deps
npm run db:push        # apply schema to the test database
npm run test:e2e       # run all E2E tests
npm run test:e2e:smoke # run tagged smoke tests
npx playwright test --ui   # interactive runner
```

See [`docs/qa-strategy.md`](docs/qa-strategy.md) for the CI/CD test strategy.

## Architecture highlights

- **Server Actions + server components** for data flow, with redirect‑based error handling.
- **Pure, unit‑testable domain logic** — e.g. the rating engine (`lib/rating.ts`) is a dependency‑free module, validated against real match data.
- **Derived match status** — game state (open / full / expired / completed) is computed from the clock at read time, not just stored, keeping the UI always correct.
- **Single source of truth for rating** — one `effectiveRating` drives the leaderboard, profile and game eligibility; the assessment "level" is a derived band.

## Running locally

```bash
git clone https://github.com/<your-github>/epci-padel-community.git
cd epci-padel-community
npm install
cp .env.example .env        # fill in your own DATABASE_URL etc.
npx prisma generate
npm run dev
```

> Note: this is a portfolio copy. Secrets are not included — provide your own database and (optional) Telegram bot credentials via environment variables.

## What I learned

- Designing a **fair rating system** for a small community: balancing convergence speed (K‑factor, provisional period) against the "feel" of per‑match swings, and preventing self‑rating inflation.
- Keeping **E2E tests reliable** with the Page Object Model and isolated, anonymised fixtures.
- Shipping a real product on Telegram's Mini App platform, including auth, notifications and deep‑link integrations.

## License

MIT — see [LICENSE](LICENSE).
