# AGENTS.md — EPCI portfolio

Read this first. It is the project memory for AI agents (Codex, Cursor, Claude Code). It mirrors
CLAUDE.md, which is the source of truth: update both together. Skills live in `.claude/skills/`.
Keep it short and current: when you learn something durable about the project,
update this file in the same PR.

## What this repo is

- **EPCI** — padel community platform (Telegram Mini App), Next.js 14 App Router +
  Server Actions, TypeScript, Prisma 5 + PostgreSQL (Supabase in prod), Tailwind, RU/EN i18n.
- This is the **public portfolio copy** (`mmzobin/epci-portfolio`). The production app lives in a
  separate private repo. **Never** copy production secrets or `.env.prod` values here.
- Main value of the repo: the **Playwright E2E suite** and its CI/CD.

## Layout

```
app/          Next.js routes (games, matches, ranking, organizer, admin, tournaments, (auth), api/)
app/api/test/reset   test-only endpoint that reseeds the DB (header x-test-token)
lib/          domain logic: rating.ts, ranked.ts, americano.ts, fixed-pairs.ts, games.ts, i18n…
prisma/       schema.prisma, migrations, seed.ts (deterministic seed for tests)
tests/        Playwright suite — see tests/README.md for conventions
docs/         qa-strategy.md, test-coverage.md, match-action-state-matrix.md
.github/workflows/  e2e, nightly-e2e, cross-browser-e2e, post-deploy-smoke, publish-report
```

## Test suite — key facts

- ~50 tests in `tests/*.spec.ts`; Page Objects in `tests/pages`, components in `tests/components`,
  seed constants in `tests/data/test-data.ts`.
- **Fixtures:** `tests/fixtures/test.ts` resets the DB via `POST /api/test/reset` before every UI test.
  `tests/fixtures/prod-test.ts` is read-only, for production smoke only.
- **Tags:** `@smoke`, `@prod-smoke` (read-only, runs against production). Regression = everything
  except `@prod-smoke`.
- **workers=1 always** with the reset fixture (shared DB). Parallelism = CI sharding (4 shards,
  each with its own Postgres service).
- Locators: `getByRole` for human-facing controls, `getByTestId` for stateful surfaces/rows.
- No fixed calendar dates in specs — generate future dates relative to the run (`tests/utils/dates.ts`).

## Commands

```bash
npm run test:e2e:regression        # full regression (needs local Postgres, see SETUP-TEST-DB.md)
npm run test:e2e:smoke
npx playwright test tests/matches.spec.ts --project=chromium   # single file
npx playwright test --last-failed  # rerun failures
npm run typecheck
```

Local runs need `DATABASE_URL`/`DIRECT_URL` pointing at a **local test DB** (same as CI:
`postgresql://postgres:postgres@127.0.0.1:5432/padel_test`), then
`npx prisma migrate deploy && npm run prisma:seed`. The dev server is started by Playwright `webServer`.

## CI

- `nightly-e2e.yml` — 01:00 UTC + manual dispatch, chromium, 4 shards. This is "the regression".
- `e2e.yml` — PRs/pushes. `cross-browser-e2e.yml` — all projects. `publish-report.yml` — HTML report
  to GitHub Pages. `post-deploy-smoke.yml` — `@prod-smoke` against production after deploy.
- CI uses a throwaway Postgres container; it never touches production data.
- `nightly-triage.yml` — after a failed nightly (or manual dispatch with a run id) runs Claude Code with the
  `triage-regression` skill: report in the job summary, PR for test-side fixes, drafted Jira bugs. Auth is the
  owner's Claude subscription (secret `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`; shares its usage
  limits, no API billing). Needs the Claude GitHub App on the repo. Pay-as-you-go alternative without a stored
  key: Anthropic workload identity federation (rule accepts `main` of `mmzobin/epci-portfolio`; verify with
  manual `anthropic-wif-check.yml`; Console org needs API credits).
- Gotchas for `nightly-triage.yml` / `claude-code-action` (all hit on 2026-11-24):
  - Workflow changes can't be tested from a branch: the action skips itself unless the workflow file is
    identical to `main` ("Workflow validation failed", step still shows success). Merge, then dispatch.
  - Keep `id-token: write` even without federation — the action uses GitHub OIDC to get the Claude App token.
  - The action hides Claude's errors; the "Show Claude error" step prints only the final result message.
    Never enable `show_full_output` (public repo: it would publish tool output).
  - Secret `CLAUDE_CODE_OAUTH_TOKEN` must be one line (~112 chars). A terminal-wrapped paste fails with
    "contains a line break". Safe re-set: `pbpaste | tr -d '\n\r ' | gh secret set CLAUDE_CODE_OAUTH_TOKEN`.
  - Federation claims from GitHub use full refs: subject `repo:mmzobin/epci-portfolio:ref:refs/heads/main`,
    `ref=refs/heads/main`; don't require `event_name=push` (triage runs on `workflow_run`/`workflow_dispatch`).
    Console shows the reason under Keys → Workload identity → Authentication events.
  - Claude subscription (Pro) and Console API credits are billed separately.

## Reporting & triage

- Reporters: list, html, junit, **Allure** (`allure-results/`), **Qase** (project `EPCI`, enabled only
  when `QASE_TESTOPS_API_TOKEN` is set).
- Nightly creates one Qase run for all shards, uploads `allure-results-merged` + `allure-report`
  artifacts (14 days) and writes the Qase run link to the job summary.
- Triage a red nightly with the skill `.claude/skills/triage-regression/SKILL.md`;
  `node scripts/allure-failures.mjs <dir>` gives a compact JSON of failures.
- Bugs go **only** to Jira space `EPCI-QA-Testing` (label `needs-triage`) via Atlassian MCP (locally) or
  `node scripts/jira.mjs` (CI; secrets `JIRA_EMAIL` + `JIRA_API_TOKEN`). Qase is for
  runs/results only — don't create Qase defects (Qase isn't integrated with Jira). Qase run URLs use
  Qase's internal run id; the `#NNN` in a run title is the GitHub Actions run number.
  Jira project key `EPCI`: types Bug/Task/Story/Epic/Subtask (product defects → Bug), workflow To Do → In Progress → Done.
- Work a Jira ticket ("возьми EPCI-N") with the skill `.claude/skills/jira-ticket/SKILL.md`.
- Jira access is the Atlassian MCP server in `.mcp.json` (OAuth, no secrets in the file). Sign in once
  via `/mcp` → atlassian → Connect. It uses the `/v1/mcp` endpoint, which Atlassian retires on
  2027-03-01; switch to `https://mcp.atlassian.com/v2/mcp` before then.

## Secrets & env

- Local secrets go in `.env` (git-ignored). Currently: `QASE_TESTOPS_API_TOKEN`.
- CI secrets live in GitHub → Settings → Secrets → Actions. Never commit tokens, never print them in logs.

## Rules for agents

- Work on a feature branch, open a PR; don't push to `main` directly.
- When fixing a failing test, **never change an assertion's expected value** just to make it green.
  If the app behaviour changed, treat it as a possible product bug and ask the human.
- Don't add `test.skip`/`fixme` or raise timeouts as a "fix" without saying so explicitly in the PR.
- Don't run anything tagged `@prod-smoke` unless asked; never run destructive actions against production.
- Prefer updating Page Objects over patching selectors inside specs.
