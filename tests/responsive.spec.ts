import { test, expect } from "./fixtures/test";
import { clubs, fullName, users, games } from "./data/test-data";

test.setTimeout(40_000);

test.describe("Responsive", () => {
  test.use({ viewport: {width: 390, height: 844}})
  test("[responsive] mobile user can login open match details and navigate profile", async ({ page, homePage, loginPage, organizerPage, userMenu, profilePage }) => {
    await loginPage.loginAndExpectHome(users.sam.email);

    await homePage.openGame(games.open);
    await expect(organizerPage.status).toContainText("Open");

    await userMenu.avatarButton.click();
    await expect(profilePage.card).toBeVisible();

  });
});
