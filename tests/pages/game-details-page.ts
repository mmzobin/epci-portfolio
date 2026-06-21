import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  waitingList: "waiting-list",
  joinButton: "game-join-button",
  leaveButton: "game-leave-button",
  error: "game-error",
  success: "game-success",
  levelMismatch: "level-mismatch-warning",
  matchBadge: (label: string) => `match-badge-${label}`,
  rosterPlayer: (firstName: string) => `roster-player-${firstName}`,
  waitingPlayer: (firstName: string) => `waiting-list-player-${firstName}`,
  messages: {
    joined: "You joined this match.",
    left: "You left this match."
  }
} as const;

export class GameDetailsPage extends BasePage {
  readonly waitingList: Locator;
  readonly joinButton: Locator;
  readonly leaveButton: Locator;
  readonly error: Locator;
  readonly success: Locator;
  readonly levelMismatch: Locator;

  constructor(page: Page) {
    super(page);
    this.waitingList = this.testId(selectors.waitingList);
    this.joinButton = this.testId(selectors.joinButton);
    this.leaveButton = this.testId(selectors.leaveButton);
    this.error = this.testId(selectors.error);
    this.success = this.testId(selectors.success);
    this.levelMismatch = this.testId(selectors.levelMismatch);
  }

  async join() {
    await this.joinButton.click();
  }

  async leave() {
    await this.leaveButton.click();
  }

  badge(label: string) {
    return this.testId(selectors.matchBadge(label));
  }

  rosterPlayer(firstName: string) {
    return this.testId(selectors.rosterPlayer(firstName));
  }

  waitingPlayer(firstName: string) {
    return this.testId(selectors.waitingPlayer(firstName));
  }

  async goto(id: string) {
    await this.page.goto(`/games/${id}`);
  }

  async expectBadge(label: string) {
    await expect(this.badge(label)).toBeVisible();
  }

  async expectJoinAction(label: string) {
    await expect(this.joinButton).toHaveText(label);
  }

  async expectJoinUnavailable() {
    await expect(this.joinButton).toHaveCount(0);
  }

  async expectLeaveUnavailable() {
    await expect(this.leaveButton).toHaveCount(0);
  }

  async expectLevelMismatch(message: string) {
    await expect(this.levelMismatch).toContainText("Level mismatch");
    await expect(this.levelMismatch).toContainText(message);
  }

  async expectPlayer(name: string) {
    await expect(this.rosterPlayer(name)).toBeVisible();
  }

  async expectWaitingPlayer(name: string) {
    await expect(this.waitingPlayer(name)).toBeVisible();
  }

  async expectPlayerAbsent(name: string) {
    await expect(this.rosterPlayer(name)).toHaveCount(0, { timeout: 60_000 });
  }

  async expectWaitingPlayerAbsent(name: string) {
    await expect(this.waitingPlayer(name)).toHaveCount(0);
  }

  async expectWaitlistActionAvailable() {
    await expect(this.joinButton).toHaveText("Join Waitlist");
    await expect(this.joinButton).toBeEnabled();
  }

  async expectJoinedMessage() {
    await expect(this.page.getByText(selectors.messages.joined)).toBeVisible();
  }

  async expectLeftMessage() {
    await expect(this.page.getByText(selectors.messages.left)).toBeVisible();
  }
}
