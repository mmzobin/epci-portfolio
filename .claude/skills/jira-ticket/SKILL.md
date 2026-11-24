---
name: jira-ticket
description: Take an EPCI Jira ticket end to end — read it, branch, make the change, show affected Playwright tests failing then passing, open a PR, comment and move the ticket through To Do → In Progress → Done. Use when asked to "возьми EPCI-N", "сделай тикет EPCI-N", "work on EPCI-N", "pick up EPCI-N".
---

# Work an EPCI Jira ticket

Goal: one ticket → one branch → one PR, with the Jira ticket telling the story (picked up →
PR + test evidence → done). A human reviews and merges every PR.

## Jira facts

- Site `mmzobin.atlassian.net`, cloudId `ab059a53-c70a-4b2d-a18b-46010dda8dc9`, project key `EPCI`
  (name EPCI-QA-Testing). Tools: Atlassian MCP server from `.mcp.json` (`mcp__atlassian__*`).
- Issue types: Bug, Task, Story, Epic, Subtask. Product defects are filed as **Bug** + label `needs-triage`.
- Workflow: **To Do → In Progress → Done**, no In Review. Transition IDs seen so far: In Progress
  `21`, Done `31` — always confirm with `getTransitionsForJiraIssue` and pick by name.
- If the Atlassian tools are missing or return auth errors, stop and tell the user to sign in via
  `/mcp` (Connect on `atlassian`). Don't work around it with the REST API or tokens from `.env`.
- **In CI** (`.github/workflows/jira-fix.yml`, started by the Jira label `claude-fix`) there is no MCP:
  use `node scripts/jira.mjs get <KEY>`, `transition <KEY> "In Progress"`, `comment <KEY> <file.md>`
  (Markdown body, `## ` headings — not Jira wiki markup). The workflow already runs a seeded throwaway
  Postgres, so the before/after Playwright runs work there too.

## 1. Read the ticket

`getJiraIssue` (markdown) with comments. Pull out: what changes, which files/areas, acceptance
criteria. If the ticket is ambiguous, or asks for something that contradicts CLAUDE.md (e.g. change
an assertion's expected value to make a test pass), ask the user before starting.

## 2. Pick it up

1. `git fetch && git switch -c EPCI-<N>-<short-kebab-summary> origin/main`.
2. Transition to **In Progress**.
3. Comment: `🤖 Picked up by Claude Code.` + branch name + a 1–2 line plan.

## 3. Find the blast radius first

Before editing, grep for every reference to what you're changing (test IDs, routes, labels, i18n
keys, seed constants in `tests/data/test-data.ts`). Test IDs are usually duplicated across several
Page Objects/components (`tests/pages/*`, `tests/components/*`) — list them all. Map them to the
specs that exercise them (e.g. `loginAndExpectHome` is used by most UI specs).

## 4. Change the app, then prove the tests notice

1. Make the app change only.
2. Run the affected specs on chromium and record the failures (this is the "before" evidence):
   ```bash
   npx playwright test <spec files> --project=chromium --reporter=line
   ```
   Prerequisites: `.env` points at the **test** DB and `TEST_DATABASE_URL == DATABASE_URL`, or the
   reset fixture returns 403. Browsers missing → `npx playwright install chromium`.
   If the dev server on :3000 was started before `.env` changed, restart it (Prisma client is cached).
3. If the ticket is test-only (no app change), skip the "before" run and say so.

## 5. Fix the tests

- Update Page Objects / components, not selectors inline in specs.
- **Never** change an assertion's expected value to make it green, add `skip`/`fixme`, or raise
  timeouts — if a test fails for a reason the ticket doesn't explain, stop and ask the user.
- Rerun the same specs (plus `@smoke`) until green; `npm run typecheck`.
- Check nothing stale remains (`grep` for the old value in `app/` and `tests/`).

## 6. PR and report

1. One commit, message starts with `EPCI-<N>: `. Push, `gh pr create` with title `EPCI-<N>: …`;
   body: Jira link, what changed, before/after test results, "selectors only / no assertions
   changed" when true.
2. Comment on the ticket: PR link, commit, files changed, tests before → after, acceptance criteria
   status. The ticket stays **In Progress** while the PR is open.
3. Don't merge. Don't run `@prod-smoke` or anything against production.

## 7. Close

When the user says the PR is merged: confirm with `gh pr view <n> --json state,mergeCommit`
(must be `MERGED`), transition to **Done**, comment with the merge commit. If the PR was closed
without merging, leave the ticket In Progress and ask.

## Report back

Short table of steps (Jira / git / tests / PR) with links, the before/after test counts, and
anything that needs a human decision.
