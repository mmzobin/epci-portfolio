import { test, expect } from "./fixtures/test";
import { users } from "./data/test-data";

test.setTimeout(40_000);

test.describe("Authentication and profile", () => {
  test("registration creates a player session", async ({ profilePage, registerPage }) => {
    await registerPage.register({
      name: "New Player",
      lastName: "NoCity",
      email: "new.player@padel.test"
    });

    await registerPage.completeLevelAssessment();
    await expect(registerPage.assessmentResult).toContainText("Your level: 3.50");
    await registerPage.saveAssessment.click();

    await expect(profilePage.card).toContainText("New Player NoCity");
    await expect(profilePage.rating).toContainText("3.50");
  });

  test("login authenticates an existing player", async ({ loginPage, userMenu }) => {
    await loginPage.loginAndExpectHome(users.maya.email);

    await expect(userMenu.avatarButton).toBeVisible();
    await userMenu.hoverAvatar();
    await expect(userMenu.profileLink).toBeVisible();
  });

  test("login page links to password recovery", async ({ loginPage }) => {
    await loginPage.goto();

    await loginPage.openPasswordRecovery();

    await loginPage.expectPasswordRecoveryVisible();
  });
  
  test("[functional] user can update profile and changes persist after relogin", async ({
    loginPage,
    profilePage,
    userMenu
  }) => {
    await loginPage.loginAndExpectHome(users.maya.email);

    await profilePage.goto();
    await profilePage.updateProfile({ name: "Dana", lastName: "Stone", city: "Tel Aviv", phone: "+972500000010", telegram: "user_dana" });
    await profilePage.expectProfileContains("Dana", "Stone", "Tel Aviv");
    await profilePage.expectEditFormValues({ phone: "+972500000010", telegram: "user_dana" });

    await userMenu.logout();

    await loginPage.loginAndExpectHome(users.maya.email);
    await profilePage.goto();
    await profilePage.expectProfileContains("Dana", "Stone", "Tel Aviv");
    await profilePage.expectEditFormValues({ phone: "+972500000010", telegram: "user_dana" });
  });
});
