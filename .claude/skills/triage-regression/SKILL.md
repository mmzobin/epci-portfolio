---
name: triage-regression
description: Triage the latest nightly Playwright regression for EPCI — download Allure results from GitHub Actions, classify each failure, rerun, open a PR for test fixes and file product bugs. Use when asked to "разбери регрессию", "triage the nightly", "why did nightly fail".
---

# Triage nightly regression

Goal: turn a red nightly run into (a) a short triage report, (b) a PR with test-side fixes,
(c) bug tickets for real product defects. A human reviews every PR and every bug.

## 1. Get the results

```bash
gh run list --workflow nightly-e2e.yml --limit 5            # pick the run (default: latest completed)
gh run download <run-id> -n allure-results-merged -D .triage/allure-results
node scripts/allure-failures.mjs .triage/allure-results > .triage/failures.json
```

If `allure-results-merged` is missing (report job failed), download every `allure-results-*`
artifact into the same folder instead. `.triage/` is scratch — never commit it.

Also note the Qase run link from the run summary (`gh run view <run-id>`).

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
- Preferred: Jira via the Atlassian MCP server if it is configured, space `EPCI-QA-Testing`,
  issue type Bug, label `needs-triage`.
- Fallback: create a defect in Qase project `EPCI` (Qase pushes it to Jira through the
  installed Jira Cloud integration), linking the test run.
- Ticket content: title `[Nightly] <what is broken>`, steps (from the test), expected vs actual,
  failing test name, Actions run link, Qase run link, screenshot/trace attachment names.
- Before filing, search existing open tickets for the same failure and comment there instead.
- If neither Jira MCP nor a Qase token is available, put the drafted tickets in the report and stop.

## 5. Report back

Reply with a short table:

| Test | Bucket | Evidence | Action (PR / ticket / none) |

Then: totals (passed / failed / flaky), links (Actions run, Qase run, PR, tickets), and anything
that needs a human decision. If you learned something durable about the suite (a known flaky
area, a new convention), add it to CLAUDE.md in the same PR.
