import { test, expect } from "./fixtures/test";
import { expectJsonError } from "./utils/api";
import { users } from "./data/test-data";

test.setTimeout(40_000);

test.describe("API", () => {
  test("[api] POST /api/level-assessment saves valid assessment for authenticated users", async ({ loginPage, page, profilePage }) => {
    await loginPage.loginAndExpectHome(users.sam.email);

    const response = await page.request.post("/api/level-assessment", {
      data: { score: 7, level: 2.0 }
    });
    expect(response.ok()).toBeTruthy();

    await profilePage.goto();
    await expect(profilePage.rating).toContainText("2.0");
  });

  test("[api] POST /api/level-assessment rejects unauthenticated request", async ({ page }) => {
    const response = await page.request.post("/api/level-assessment", {
      data: { score: 7, level: 2.0 }
    });
    await expectJsonError(response, 401);
  });

  test("[api] POST /api/test/reset rejects invalid reset token", async ({ page }) => {
    const response = await page.request.post("/api/test/reset", {
      headers: {
        "x-test-token": "wrong-token"
      }
    });
    expect([401, 403]).toContain(response.status());
  });
});
