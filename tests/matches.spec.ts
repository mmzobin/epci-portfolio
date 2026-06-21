import { test, expect } from "./fixtures/test";
import { games, users } from "./data/test-data";
import { getGameIdByTitle } from "./utils/games";

test.setTimeout(40_000);

test.describe("Match cards", () => {
  test("open match card for a non-joined player shows join and one details action", async ({
    homePage,
    loginPage
  }) => {
    await loginPage.loginAndExpectHome(users.sam.email);

    await expect(homePage.gameAction(games.open, "Join Match")).toBeVisible();
    await expect(homePage.detailsLink(games.open)).toHaveCount(1);
    await expect(homePage.gameBadge(games.open, "Joined")).toHaveCount(0);
  });

  test("regular user can join an open match from the home page", async ({ homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.sam.email);

    await homePage.joinFromCard(games.open);

    await expect(homePage.gameBadge(games.open, "Joined")).toBeVisible({ timeout: 60_000 });
    await homePage.expectJoinedCount(games.open, "2/4");
    await expect(homePage.gameAction(games.open, /Join|Joined/)).toHaveCount(0);
  });

  test("open match card for a joined player shows a badge instead of disabled join", async ({
    homePage,
    loginPage
  }) => {
    await loginPage.loginAndExpectHome(users.daniel.email);

    await expect(homePage.gameBadge(games.open, "Joined")).toBeVisible();
    await expect(homePage.detailsLink(games.open)).toHaveCount(1);
    await expect(homePage.gameAction(games.open, /Join|Joined/)).toHaveCount(0);
  });

  test("open match card for the host shows host badge, join, and manage action", async ({ homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);

    await expect(homePage.gameBadge(games.open, "Host")).toBeVisible();
    await expect(homePage.gameAction(games.open, "Join Match")).toBeVisible();
    await expect(homePage.detailsLink(games.open)).toHaveCount(1);
    await expect(homePage.manageLink(games.open)).toBeVisible();
  });

  test("full match card for a non-joined player shows waitlist action", async ({ homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);

    await expect(homePage.gameBadge(games.full, "Full")).toBeVisible();
    await expect(homePage.gameAction(games.full, "Join Waitlist")).toBeVisible();
    await expect(homePage.detailsLink(games.full)).toHaveCount(1);
    await expect(homePage.manageLink(games.full)).toBeVisible();
  });

  test("full match card shows level mismatch for disabled waitlist action", async ({ homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);

    await expect(homePage.gameAction(games.full, "Join Waitlist")).toBeDisabled();
    await homePage.expectLevelMismatch(
      games.full,
      "Your current level is 2.0. This game requires players between 3.0 and 4.5."
    );
  });

  test("full match card for a joined player shows joined badge and no join", async ({ homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.daniel.email);

    await expect(homePage.gameBadge(games.full, "Joined")).toBeVisible();
    await expect(homePage.detailsLink(games.full)).toHaveCount(1);
    await expect(homePage.gameAction(games.full, /Join|Joined/)).toHaveCount(0);
  });

  test("completed and cancelled matches are hidden from the home page", async ({ homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);

    await homePage.expectGameHidden(games.completed);
    await homePage.expectGameHidden(games.cancelled);
  });

  test("expired matches are hidden from home and inactive in organizer views", async ({
    gameDetailsPage,
    homePage,
    loginPage,
    organizerPage
  }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await homePage.expectGameHidden(games.pastOpen);
    await homePage.expectGameHidden(games.pastFull);

    await organizerPage.goto();
    await expect(organizerPage.gameRow(games.pastOpen)).toContainText("Expired");
    await expect(organizerPage.gameRow(games.pastFull)).toContainText("Expired");

    await organizerPage.openGame(games.pastOpen);
    await gameDetailsPage.expectBadge("Expired");
    await expect(organizerPage.gameAction("cancel")).toBeDisabled();
    // Expired games can't be reopened or cancelled, but CAN be completed
    // (confirm the result after the match was played).
    await expect(organizerPage.gameAction("complete")).toBeEnabled();
    await expect(organizerPage.gameAction("open")).toBeDisabled();
  });

  test("[regression] cancelled game deep link is read-only and not joinable", async ({ gameDetailsPage, loginPage, homePage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);
    await homePage.expectGameHidden(games.cancelled);
    
    await gameDetailsPage.goto(await getGameIdByTitle(games.cancelled));

    await gameDetailsPage.expectBadge("Cancelled");
    await gameDetailsPage.expectJoinUnavailable();
    await gameDetailsPage.expectLeaveUnavailable();
  });
});

test.describe("Match details", () => {
  test("player joins an open game", async ({ gameDetailsPage, homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.sam.email);
    await homePage.openGame(games.open);

    await gameDetailsPage.expectJoinAction("Join Match");
    await gameDetailsPage.join();

    await gameDetailsPage.expectPlayer(users.sam.name);
    await gameDetailsPage.expectBadge("Joined");
    await gameDetailsPage.expectJoinUnavailable();
    await gameDetailsPage.expectJoinedMessage();
  });

  test("player cannot join a game outside their level range", async ({ gameDetailsPage, homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);
    await homePage.openGame(games.open);

    await expect(gameDetailsPage.joinButton).toBeDisabled();
    await gameDetailsPage.expectLevelMismatch(
      "Your current level is 2.0. This game requires players between 2.5 and 4.0."
    );
  });

  test("full match waitlist shows level mismatch when player level is outside range", async ({
    gameDetailsPage,
    homePage,
    loginPage
  }) => {
    await loginPage.loginAndExpectHome(users.nina.email);
    await homePage.openGame(games.full);

    await gameDetailsPage.expectJoinAction("Join Waitlist");
    await expect(gameDetailsPage.joinButton).toBeDisabled();
    await gameDetailsPage.expectLevelMismatch(
      "Your current level is 2.0. This game requires players between 3.0 and 4.5."
    );
  });

  test("player leaves a game", async ({ gameDetailsPage, homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.daniel.email);
    await homePage.openGame(games.open);

    await gameDetailsPage.expectBadge("Joined");
    await gameDetailsPage.expectJoinUnavailable();
    await gameDetailsPage.leave();

    await gameDetailsPage.expectPlayerAbsent(users.daniel.name);
    await gameDetailsPage.expectJoinAction("Join Match");
    await gameDetailsPage.expectLeftMessage();
  });

  test("full match details can be joined as waitlist by a non-participant", async ({
    gameDetailsPage,
    homePage,
    loginPage
  }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await homePage.openGame(games.full);

    await gameDetailsPage.expectBadge("Full");
    await gameDetailsPage.expectJoinAction("Join Waitlist");
    await gameDetailsPage.join();

    await gameDetailsPage.expectBadge("On Waitlist");
    await expect(gameDetailsPage.leaveButton).toBeVisible();
  });

  test("first waiting player is promoted when a joined player leaves", async ({
    gameDetailsPage,
    homePage,
    loginPage
  }) => {
    await loginPage.loginAndExpectHome(users.daniel.email);
    await homePage.openGame(games.full);

    await gameDetailsPage.leave();

    await gameDetailsPage.expectPlayer(users.tom.name);
    await gameDetailsPage.expectWaitingPlayerAbsent(users.tom.name);
  });

  test("cancelled game cannot be joined", async ({ gameDetailsPage, homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);
    await homePage.expectGameHidden(games.cancelled);

    await gameDetailsPage.goto(await getGameIdByTitle(games.cancelled));

    await gameDetailsPage.expectBadge("Cancelled");
    await gameDetailsPage.expectJoinUnavailable();
    await gameDetailsPage.expectLeaveUnavailable();
  });

  test("completed game cannot be joined", async ({ gameDetailsPage, homePage, loginPage }) => {
    await loginPage.loginAndExpectHome(users.nina.email);
    await homePage.expectGameHidden(games.completed);

    await gameDetailsPage.goto(await getGameIdByTitle(games.completed));

    await gameDetailsPage.expectBadge("Completed");
    await gameDetailsPage.expectJoinUnavailable();
    await gameDetailsPage.expectLeaveUnavailable();
  });

  test("[functional] user can leave waitlist from full match:", async ({ loginPage, homePage, gameDetailsPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await homePage.openGame(games.full);

    await gameDetailsPage.expectWaitlistActionAvailable();
    await gameDetailsPage.join();
    await gameDetailsPage.expectBadge("On Waitlist");
    await gameDetailsPage.leave();
    await gameDetailsPage.expectJoinAction("Join Waitlist");
  });

  test("[regression] waitlisted player is promoted when participant leaves and order is preserved", async ({
    loginPage,
    homePage,
    gameDetailsPage
  }) => {
    await loginPage.loginAndExpectHome(users.daniel.email);
    await homePage.openGame(games.full);

    await gameDetailsPage.expectWaitingPlayer(users.tom.name);

    await gameDetailsPage.leave();

    await gameDetailsPage.expectPlayer(users.tom.name);
    await gameDetailsPage.expectWaitingPlayerAbsent(users.tom.name);
  });
});
