import { test, expect } from "./fixtures/test";
import { clubs, fullName, users } from "./data/test-data";

test.setTimeout(40_000);

test.describe("Smoke", () => {
  test("@smoke guest can not open ranking but can open login and register pages", async ({ page, homePage, rankingPage, loginPage, registerPage }) => {
    await page.goto("/");
    await expect(homePage.joinCommunityButton).toBeVisible();

    await rankingPage.gotoNegative();

    await loginPage.goto();

    await registerPage.goto();

  });
});
