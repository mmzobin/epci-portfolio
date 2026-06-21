import { test, expect } from "./fixtures/test";
import { clubs, fullName, users } from "./data/test-data";

test.setTimeout(40_000);

test.describe("Ranking", () => {
  test("ranking uses completed mini-tournament results", async ({ rankingPage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.daniel.email)
    await rankingPage.goto();

    await expect(rankingPage.search).toBeVisible();
    await expect(rankingPage.player(users.maya.name)).toContainText(fullName(users.maya));
    await expect(rankingPage.player(users.michael.name)).toContainText("3.50");
    await expect(rankingPage.firstPlayer()).toContainText(fullName(users.daniel));
  });
});
