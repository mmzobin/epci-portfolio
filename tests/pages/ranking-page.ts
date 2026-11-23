import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  search: "ranking-search",
  player: (firstName: string) => `ranking-player-${firstName}`,
  firstPlayer: '[data-testid^="ranking-player-"]',
  tournamentStats: "player-tournament-stats",
  tournamentPoints: "player-tournament-points"
} as const;

export class RankingPage extends BasePage {
  readonly search: Locator;
  readonly tournamentStats: Locator;
  readonly tournamentPoints: Locator;

  constructor(page: Page) {
    super(page);
    this.search = this.testId(selectors.search);
    this.tournamentStats = this.testId(selectors.tournamentStats);
    this.tournamentPoints = this.testId(selectors.tournamentPoints);
  }

  async goto() {
    await this.page.goto("/ranking");
    await expect(this.search).toBeVisible();
  }

  async gotoNegative() {
    await this.page.goto("/ranking");
    await expect(this.page).not.toHaveURL(/\/ranking$/);
  }

  player(firstName: string) {
    return this.testId(selectors.player(firstName));
  }

  firstPlayer() {
    return this.page.locator(selectors.firstPlayer).first();
  }

  async openPlayer(firstName: string) {
    await Promise.all([
      this.page.waitForURL(/\/ranking\/[^/]+$/),
      this.player(firstName).click()
    ]);
  }
}
