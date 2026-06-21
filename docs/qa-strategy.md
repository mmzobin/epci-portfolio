# QA Automation Strategy

This project uses Playwright end-to-end tests as the main confidence layer for
critical user journeys in the EPCI padel community app.

See [`docs/test-coverage.md`](./test-coverage.md) for the full feature × test-type
coverage matrix.

## Goals

- Catch regressions in auth, matchmaking, organizer, admin, ranking, API,
  accessibility, and responsive flows.
- Keep test runs deterministic through seeded data and a guarded reset endpoint.
- Run regression safely in parallel without sharing mutable database state.
- Keep production monitoring non-destructive and black-box.
- Preserve reports, traces, screenshots, and videos for debugging failed runs.

## Test Layers

| Layer | Target | Data policy | Trigger |
| --- | --- | --- | --- |
| PR / push regression | Local CI app + isolated PostgreSQL | Destructive reset allowed | `E2E` workflow |
| Nightly regression | Local CI app + isolated PostgreSQL | Destructive reset allowed | `Nightly E2E Regression` workflow |
| Post-deploy smoke | Deployed production or preview URL | Read-only, no reset | `Post-Deploy Smoke` workflow |

## Database Isolation

Most UI tests currently use `tests/fixtures/test.ts`, which calls
`POST /api/test/reset` before each test. That makes every test deterministic, but
it also means a single shared database cannot safely support parallel workers.

The chosen strategy is:

- Keep `workers=1` inside each Playwright process.
- Split the suite with Playwright sharding.
- Run each shard in a separate GitHub Actions job.
- Give each shard its own PostgreSQL service container.

This gives true parallelism while keeping reset-based tests safe. A reset in
shard `1/4` cannot affect shard `2/4` because they run against different
databases.

The reset endpoint has production guard rails:

- Production rejects reset unless `ENABLE_TEST_RESET=true`.
- `DATABASE_URL` must exactly match `TEST_DATABASE_URL`.
- A valid `TEST_RESET_TOKEN` is required.

## Workflows

### E2E

`.github/workflows/e2e.yml`

Runs on pull requests, pushes to `main`, and manual dispatch.

- Typecheck and build.
- Runs 4 Playwright shards.
- Each shard has its own PostgreSQL service.
- Excludes `@prod-smoke`.
- Uploads Playwright HTML report and `test-results`.

### Nightly E2E Regression

`.github/workflows/nightly-e2e.yml`

Runs every night and can be started manually.

- Full regression, excluding `@prod-smoke`.
- Same isolated DB shard model as PR regression.
- Keeps artifacts longer than PR runs.

### Post-Deploy Smoke

`.github/workflows/post-deploy-smoke.yml`

Runs after successful production deployments and can be started manually with a
`base_url`.

- Uses `PLAYWRIGHT_SKIP_WEB_SERVER=1`.
- Runs only `tests/prod-smoke.spec.ts`.
- Uses `tests/fixtures/prod-test.ts`, which never resets the database.
- Does not run migrations or seed.
- Does not require database credentials.

For automatic production deployment events, set the repository secret
`PRODUCTION_BASE_URL` to the public application URL. This avoids accidentally
smoke-testing a provider dashboard or protected deployment URL. If Vercel
Deployment Protection is enabled, also set `VERCEL_AUTOMATION_BYPASS_SECRET`;
Playwright sends it as the `x-vercel-protection-bypass` header.

## Tags

Current operational tags:

- `@smoke` - fast smoke against the test/staging app with reset fixture.
- `@prod-smoke` - read-only smoke safe for production.

Recommended next tags:

- `@regression` - full regression scenarios.
- `@api` - API coverage.
- `@a11y` - accessibility coverage.
- `@mobile` - mobile/responsive coverage.
- `@destructive` - tests that intentionally mutate database state.

## Reports And Debug Artifacts

Playwright is configured to produce:

- list reporter in logs;
- HTML report in `playwright-report`;
- JUnit report in `test-results/junit.xml`;
- trace, screenshot, and video on failure.

Reports and raw test results are uploaded by all CI workflows.

## Local Commands

```bash
npm run typecheck
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:regression
BASE_URL=https://example.com npm run test:e2e:prod-smoke
npm run test:e2e:report
```

## Known Follow-Ups

- Replace fixed future dates in specs with generated future dates.
- Complete tag taxonomy across all specs.
- Consider role-based storage state after CI is stable.
- Add notification for nightly failures if a real team channel is available.
