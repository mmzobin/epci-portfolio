import { test, expect } from "./fixtures/test";
import { clubs, users } from "./data/test-data";
import page from "@/app/organizer/games/[id]/page";

test.setTimeout(40_000);

test.describe("Admin", () => {
  test("admin manages clubs", async ({ adminClubsPage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await adminClubsPage.goto();

    await adminClubsPage.createClub({
      name: "North Padel",
      city: "Haifa",
      address: "Port 5",
      price: "400.50"
    });

    await expect(adminClubsPage.row("North Padel")).toBeVisible();
  });

  test("admin creates and completes a mini-tournament", async ({
    adminTournamentsPage,
    loginPage,
    rankingPage
  }) => {
    test.setTimeout(300_000);
    await loginPage.loginAndExpectHome(users.admin.email);
    await adminTournamentsPage.goto();

    await adminTournamentsPage.createTournament({
      title: "Test Mini Cup",
      startsAt: "2026-07-12T18:00",
      city: clubs.telAviv.city,
      club: clubs.telAviv.name
    });

    await adminTournamentsPage.expectHeading("Test Mini Cup", { timeout: 60_000 });
    await adminTournamentsPage.addParticipants(users.michael.name);
    await expect(adminTournamentsPage.participant(users.michael.name)).toContainText("Waiting List", { timeout: 60_000 });
    await adminTournamentsPage.addParticipants(users.maya.name);
    await expect(adminTournamentsPage.participants).not.toContainText("Waiting List", { timeout: 60_000 });

    await adminTournamentsPage.quickFillMatches("1");
    await adminTournamentsPage.fillResult(users.michael.name, "1", "1");
    await adminTournamentsPage.fillResult(users.maya.name, "1", "0");
    await adminTournamentsPage.saveResults();

    await expect(adminTournamentsPage.success).toBeVisible({ timeout: 60_000 });
    await expect(adminTournamentsPage.points(users.michael.name)).toHaveText("5", { timeout: 60_000 });
    await expect(adminTournamentsPage.points(users.maya.name)).toHaveText("1", { timeout: 60_000 });
    await adminTournamentsPage.completeTournament();

    await expect(adminTournamentsPage.status()).toHaveText("Completed", { timeout: 60_000 });
    await rankingPage.goto();
    await rankingPage.openPlayer(users.michael.name);
    await expect(rankingPage.tournamentPoints).toHaveText("27", { timeout: 60_000 });
  });

  test("[functional] admin can change user role and new permissions are applied", async ({ userMenu, loginPage, adminUsersPage, organizerPage, homePage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await adminUsersPage.goto();
    await adminUsersPage.changeRole(users.maya.email, "ORGANIZER");
    await expect(adminUsersPage.success).toBeVisible();
    await userMenu.logout();

    await loginPage.loginAndExpectHome(users.maya.email);
    await expect(homePage.createGameButton).toBeVisible();
    await organizerPage.goto();
    await expect(organizerPage.newGameLink).toBeVisible();
  });

  test("[negative] non-admin cannot access admin users page", async ({ page, loginPage, adminUsersPage }) => {
    await loginPage.loginAndExpectHome(users.sam.email);
    await adminUsersPage.gotoNegative();
  });

  test("[negative] tournament results reject wins greater than matches", async ({ adminTournamentsPage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await adminTournamentsPage.goto();

    await adminTournamentsPage.createTournament({
      title: "Invalid Results Cup",
      startsAt: "2026-07-12T18:00",
      city: clubs.telAviv.city,
      club: clubs.telAviv.name
    });
    await adminTournamentsPage.addParticipants(users.michael.name, users.maya.name);

    await adminTournamentsPage.fillResult(users.michael.name, "1", "2");
    await expect(adminTournamentsPage.participant(users.michael.name)).toContainText(/Wins.*exceed.*matches/i);
    await expect(adminTournamentsPage.saveResultsButton).toBeDisabled();
  });

  test("[negative] club creation validates required fields", async ({ adminClubsPage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await adminClubsPage.goto();

    await adminClubsPage.createClub({
      name: "",
      city: "",
      address: "",
      price: ""
    });

    await expect(adminClubsPage.row("")).toHaveCount(0);
    await expect(adminClubsPage.error.or(adminClubsPage.createForm)).toBeVisible();
  });
});
