---
name: triage-regression
description: Triage a failed EPCI Playwright regression — from the latest nightly, a GitHub Actions run, or a Qase run link — classify each failure, rerun, open a PR for test fixes and file product bugs in Jira. Use when asked to "разбери регрессию", "разбери прогон <qase link>", "triage the nightly", "why did nightly fail".
---

# Triage nightly regression

Goal: turn a red nightly run into (a) a short triage report, (b) a PR with test-side fixes,
(c) bug tickets for real product defects. A human reviews every PR and every bug.

## 1. Get the results

Bugs live **only in Jira**. Qase holds runs, results and history; use it as an input and link to
it, never file defects there.

**Starting from GitHub Actions** (default: latest completed nightly):

```bash
gh run list --workflow nightly-e2e.yml --limit 5            # pick the run
gh run download <run-id> -n allure-results-merged -D .triage/allure-results
node scripts/allure-failures.mjs .triage/allure-results > .triage/failures.json
```

If `allure-results-merged` is missing (report job failed), download every `allure-results-*`
artifact into the same folder instead. `.triage/` is scratch — never commit it.
Take the Qase run link from the run summary (`gh run view <run-id>`).

**Starting from a Qase link** (`https://app.qase.io/run/EPCI/dashboard/<qase-run-id>`):

- The number in the URL is Qase's internal run id. The `#NNN` in the run title
  ("Nightly regression 2026-11-23 #161") is the **GitHub Actions run number** — use it to find the
  Actions run (`gh run list --workflow nightly-e2e.yml --json number,databaseId`) and download Allure
  as above for traces and screenshots.
- Read failures from the Qase REST API with `QASE_TESTOPS_API_TOKEN` from `.env`, sent as the
  `Token` header. Never print the token.
  ```bash
  set -a; . ./.env; set +a
  curl -sS -H "Token: $QASE_TESTOPS_API_TOKEN" "https://api.qase.io/v1/run/EPCI/<qase-run-id>"
  curl -sS -H "Token: $QASE_TESTOPS_API_TOKEN" "https://api.qase.io/v1/result/EPCI?run=<qase-run-id>&status=failed&limit=100"
  curl -sS -H "Token: $QASE_TESTOPS_API_TOKEN" "https://api.qase.io/v1/case/EPCI/<case-id>"   # test title
  ```
- Each retry is a separate result, so one failing test usually shows 3 results with the same
  `case_id`. Group by `case_id`. The error text is in `stacktrace` / `comment`.
- If the Qase token is missing or rejected, fall back to Allure only and say so in the report.

## 2. Classify every failure

For each entry in `failures.json` read the message, failed step, trace lines and the spec/page
object involved. Put it in exactly one bucket:

| Bucket | Typical signals | Action |
|---|---|---|
| **flaky** | `flaky-passed-on-retry`; passes on local rerun; timing/race | Fix wait/locator if obvious, else report only |
| **environment** | DB/seed/reset endpoint errors, `ECONNREFUSED`, webServer timeout, artifact/CI step errors | Report; no code change in tests |
| **test bug** | selector no longer matches but UI is correct; outdated test data; wrong helper | Fix in Page Object / test data → PR |
| **product bug** | app behaves wrong vs. spec/coverage docs (`docs/test-coverage.md`, `docs/match-action-state-matrix.md`) | File bug; do NOT touch the assertion |

When unsure between *test bug* and *product bug*, look at `git log -p` for the relevant `app/` or
`lib/` files since the last green nightly. A recent app change that explains the failure points to
a product bug (or an intended change the human must confirm).

## 3. Reproduce

Run locally only if a test DB is available (see CLAUDE.md → Commands):

```bash
npx playwright test <spec> -g "<test name>" --project=chromium --repeat-each=3
```

If no local DB, reason from the trace/screenshot attachments and say so in the report.

## 4. Act

**Test fixes** — one branch `fix/nightly-<YYYY-MM-DD>`, one PR, one commit per test. Prefer fixing
Page Objects over specs. PR body: table of failures → bucket → fix, plus the Actions run link.

Hard rules:
- Never change an expected value / assertion to make a test pass. That is a product-bug candidate.
- No new `test.skip`, `test.fixme`, or bigger timeouts unless the PR states it explicitly and why.
- Never run `@prod-smoke` or anything against production.

**Product bugs** — one ticket per distinct root cause (dedupe failures with the same cause):
- Jira only, via the Atlassian MCP server: project `EPCI` (EPCI-QA-Testing), cloudId
  `ab059a53-c70a-4b2d-a18b-46010dda8dc9`, work type **Bug**, label `needs-triage`.
- **Do not create Qase defects.** Qase is not connected to Jira, so a defect there would be a
  second, unsynced bug list.
- Ticket content: title `[Nightly] <what is broken>`, steps (from the test), expected vs actual,
  failing test name + file:line, Actions run link, Qase run link
  (`https://app.qase.io/run/EPCI/dashboard/<qase-run-id>`), Qase case id(s), screenshot/trace
  attachment names, and the suspect commit if you found one.
- Before filing, search open EPCI tickets (JQL on the test name / error text) and comment there
  instead of filing a duplicate.
- If the Atlassian tools are missing or unauthorized, put the drafted tickets in the report and
  stop; tell the user to sign in via `/mcp`.

## 5. Report back

Reply with a short table:

| Test | Bucket | Evidence | Action (PR / ticket / none) |

Then: totals (passed / failed / flaky), links (Actions run, Qase run, PR, tickets), and anything
that needs a human decision. If you learned something durable about the suite (a known flaky
area, a new convention), add it to CLAUDE.md in the same PR.
