import { test, expect } from "./fixtures/test";
import { clubs, fullName, games, users } from "./data/test-data";
import { futureDateTimeLocal } from "./utils/dates";

test.setTimeout(40_000);

test.describe("Organizer matches", () => {
  test("organizer creates a game", async ({ header, loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();

    await organizerPage.createGameAndExpectSuccess({
      title: "Friday Rookie Padel",
      startsAt: futureDateTimeLocal(),
      city: clubs.telAviv.city,
      clubLabel: clubs.telAviv.name,
      courtNumber: "A",
      maxPlayers: "4"
    });

    await organizerPage.expectGameHeading("Friday Rookie Padel");
    await organizerPage.expectStatus("Open")

    await header.openGames();
    await expect(organizerPage.gameRow("Friday Rookie Padel")).toBeVisible();
  });

  test("organizer cannot create a game in the past", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();

    await organizerPage.createGame({
      title: "Yesterday Padel",
      startsAt: "2026-01-01T19:00",
      courtNumber: "A"
    });

    await organizerPage.expectPastDateError();
  });

  test("organizer can complete an expired game played retroactively", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.pastOpen);

    await organizerPage.expectStatusLabelVisible();
    await organizerPage.expectBadge("Expired")
    // An expired game (it started while still open/full) can be confirmed after
    // the match was actually played — completing it records the result.
    await expect(organizerPage.gameAction("complete")).toBeEnabled();

    await organizerPage.completeGame();
    await organizerPage.expectBadge("Completed");
    await expect(organizerPage.gameAction("complete")).toBeDisabled();
  });

  test("organizer cannot complete a future game", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.open);

    await expect(organizerPage.gameAction("complete")).toBeDisabled();
    await organizerPage.expectStatusLabelVisible();
    await organizerPage.expectStatus("Open")
    await organizerPage.expectParticipantTextAbsent("Played");
  });

  test("completed game cannot be reopened or cancelled", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.completed);

    await expect(organizerPage.gameAction("open")).toBeDisabled();
    await expect(organizerPage.gameAction("cancel")).toBeDisabled();
    await expect(organizerPage.gameAction("complete")).toBeDisabled();
  });

  test("cancelled game cannot be completed", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.cancelled);

    await expect(organizerPage.gameAction("complete")).toBeDisabled();
    await expect(organizerPage.gameAction("cancel")).toBeDisabled();
    await expect(organizerPage.gameAction("open")).toBeEnabled();
  });

  test("organizer marks payment as paid", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.full);

    await organizerPage.markPaid(users.daniel.name);
    await organizerPage.expectParticipantText("Joined");
    await organizerPage.expectParticipantText("Paid");

    await organizerPage.markUnpaid(users.daniel.name);
    await organizerPage.expectParticipantText("Joined");
    await organizerPage.expectParticipantText("Unpaid");
  });

  test("organizer marks no-show only after a game can be settled", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.full);

    await organizerPage.expectSettlementActionHidden("no-show", users.daniel.name);
    await organizerPage.expectSettlementActionHidden("no-show", users.tom.name);

    await organizerPage.goto();
    await organizerPage.openGame(games.completed);
    await organizerPage.markNoShow(users.daniel.name);
    await organizerPage.expectParticipantText("No-show");
    await organizerPage.markPlayed(users.daniel.name);
    await organizerPage.expectParticipantText("Played");
  });

  test("organizer cannot mark a waiting player as paid", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.full);

    await organizerPage.expectSettlementActionHidden("paid", users.tom.name);
  });

  test("organizer cannot confirm a waiting player outside the game level range", async ({
    loginPage,
    organizerPage
  }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.full);

    await organizerPage.setMaxLevel("3");
    await organizerPage.approveWaiting(users.tom.name);

    await organizerPage.expectLevelRangeError();
  });

  test("admin manually adds an eligible player to a game", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.open);

    await organizerPage.addPlayer(users.sam.name);

    await organizerPage.expectParticipantText(`${fullName(users.sam)} · 3.5`);
  });

  test("[functional] organizer can edit game club and price is recalculated", async ({ header, loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.open);

    await organizerPage.updateGame({
      title: "Updated Game Title",
      startsAt: "2026-07-10T19:00",
      city: clubs.rishonLeZion.city,
      clubLabel: clubs.rishonLeZion.name,
      courtPrice: "50",
      courtNumber: "7",
      maxPlayers: "4",
      minLevel: "3",
      maxLevel: "5"
    });

    await header.openGames();

    await expect(organizerPage.gameRow("Updated Game Title")).toBeVisible();

    await organizerPage.openGame("Updated Game Title");
    await expect(organizerPage.field("address")).toHaveValue(/8 Rothschild St/i);
    await expect(organizerPage.field("courtPrice")).toHaveValue(/50/i);
    await expect(organizerPage.field("courtNumber")).toHaveValue(/7/i);
    await expect(organizerPage.field("maxPlayers")).toHaveValue(/4/i);
    await expect(organizerPage.field("city")).toHaveValue(/Rishon Le Zion/i);
    await expect(organizerPage.selectedClub()).toHaveText("Rishon Padel Park");
    await expect(organizerPage.field("minLevel")).toHaveValue(/3/i);
    await expect(organizerPage.field("maxLevel")).toHaveValue(/5/i);
  });

  test("[functional] organizer can cancel an open game", async ({ loginPage, organizerPage, header }) => {
    await loginPage.loginAndExpectHome(users.oleg.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.open);

    await organizerPage.cancelGame();

    await organizerPage.expectBadge("Cancelled")
    await expect(organizerPage.gameAction("complete")).toBeDisabled();
    await expect(organizerPage.gameAction("cancel")).toBeDisabled();

    await header.openGames();
    await organizerPage.expectGameRowBadge(games.open, "Cancelled");
  });

  test("[negative] non-organizer cannot access organizer page management", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.tom.email);
    await organizerPage.gotoNegative ();
  });

  test("[negative] organizer cannot add the same player twice", async ({ loginPage, organizerPage }) => {
    await loginPage.loginAndExpectHome(users.admin.email);
    await organizerPage.goto();
    await organizerPage.openGame(games.open);

    await organizerPage.addPlayer(users.sam.name);
    await organizerPage.expectParticipantText(`${fullName(users.sam)} · 3.5`);
      
    await organizerPage.expectAddPlayerOptionHidden(users.sam.name);
  });
});
