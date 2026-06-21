# Playwright Test Infrastructure

The suite covers critical EPCI flows with Playwright, TypeScript, Page Objects,
deterministic seed data, and CI-safe database isolation.

For the full CI/CD strategy, see [QA Automation Strategy](../docs/qa-strategy.md).

## Structure

```text
tests/
  fixtures/     # Playwright fixtures: reset-based and production-safe
  pages/        # Page Objects for screens and user journeys
  components/   # Reusable UI component objects
  data/         # Seed constants used by tests
  utils/        # API and DB helpers
  *.spec.ts     # Specs grouped by feature
```

## Fixtures

Use the reset-based fixture for local, PR, nightly, and staging regression tests:

```ts
import { expect, test } from "./fixtures/test";
```

This fixture calls `POST /api/test/reset` before each UI test, so tests start
from deterministic seed data.

Use the production-safe fixture only for read-only production smoke tests:

```ts
import { expect, test } from "./fixtures/prod-test";
```

This fixture never resets the database and must not perform destructive actions.

## Example

```ts
import { expect, test } from "./fixtures/test";
import { games, users } from "./data/test-data";

test("player can join an open game", async ({ loginPage, homePage, gameDetailsPage }) => {
  await loginPage.loginAs(users.sam.email);
  await homePage.openGame(games.open);
  await gameDetailsPage.join();
  await expect(gameDetailsPage.players).toContainText(users.sam.name);
});
```

## Commands

```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:regression
BASE_URL=https://example.com npm run test:e2e:prod-smoke
npm run test:e2e:report
```

## Parallel Execution

Do not enable `workers > 1` against a shared database while tests use the reset
fixture. A parallel worker could reset the database while another worker is in
the middle of a scenario.

CI parallelism is implemented with Playwright sharding instead:

- 4 shards run in separate GitHub Actions jobs.
- Each job gets its own PostgreSQL service container.
- Each shard keeps `workers=1`.

This makes reset-based tests deterministic while still reducing total CI time.

## Tags

Current tags:

- `@smoke` - smoke against local/staging test data.
- `@prod-smoke` - read-only production smoke.

Recommended tags for new tests:

- `@api`
- `@a11y`
- `@mobile`
- `@regression`
- `@destructive`

## Conventions

- Put reusable user journeys in `tests/pages/*`.
- Put reusable component interactions in `tests/components/*`.
- Put seed constants in `tests/data/test-data.ts`.
- Prefer `getByRole` for human-facing controls.
- Use `getByTestId` for stateful app surfaces, rows, alerts, and generated controls.
- Import `test` and `expect` from `tests/fixtures/test.ts` for reset-based UI tests.
- Import from `tests/fixtures/prod-test.ts` only for read-only production smoke tests.
- Use `request` directly for unauthenticated API tests.
- Call `resetApp(request)` from `tests/utils/api.ts` when an API test does not use the page fixture.
- For authenticated API tests, log in through `loginPage.loginAs(...)`, then call the endpoint through `page.request` so the session cookie is reused.
- Avoid fixed calendar dates in specs; generate future dates relative to the test run.
