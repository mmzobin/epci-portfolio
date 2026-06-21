import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures/test";
import { users } from "./data/test-data";

test.setTimeout(40_000);

const knownIssues = ["color-contrast", "meta-viewport"];

for (const path of ["/", "/ranking", "/login", "/register"]) {
  test(`[accessibility] ${path} has no critical accessibility violations`, async ({ page, loginPage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(knownIssues)
      .analyze();

    expect(results.violations).toEqual([]);

  });
}
