import { test, expect } from "./fixtures/prod-test";

test.describe("Production smoke", () => {
  test("@prod-smoke public pages are available without database reset", async ({
    homePage,
    loginPage,
    page,
    rankingPage,
    registerPage
  }) => {
    await page.goto("/");
    await expect(homePage.joinCommunityButton).toBeVisible();

    await rankingPage.gotoNegative();

    await loginPage.goto();

    await registerPage.goto();
  });
});
