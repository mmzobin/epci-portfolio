import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  gamesList: "games-list",
  createGameButton: "hero-create",
  browseGamesButton: "hero-games",
  joinCommunityButton: "guest-join-community",
  gameCard: (title: string) => `game-card-${title}`,
  matchBadge: (badge: string) => `match-badge-${badge}`,
  joinedCount: "joined-count",
  levelMismatch: "level-mismatch-warning",
  actions: {
    gameButtonRole: "button",
    viewDetails: { role: "link", options: { name: "View Details", exact: true } },
    manageMatch: { role: "link", options: { name: "Manage Match", exact: true } },
    joinMatch: { role: "button", options: { name: "Join Match", exact: true } }
  }
} as const;

export class HomePage extends BasePage {
  readonly gamesList: Locator;
  readonly createGameButton: Locator;
  readonly browseGamesButton: Locator;
  readonly joinCommunityButton: Locator;
  constructor(page: Page) {
    super(page);
    this.gamesList = this.testId(selectors.gamesList);
    this.createGameButton = this.testId(selectors.createGameButton);
    this.browseGamesButton = this.testId(selectors.browseGamesButton);
    this.joinCommunityButton = this.testId(selectors.joinCommunityButton);
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.gamesList).toBeVisible();
  }

  gameCard(title: string) {
    return this.testId(selectors.gameCard(title));
  }

  gameBadge(title: string, badge: string) {
    return this.gameCard(title).getByTestId(selectors.matchBadge(badge));
  }

  gameAction(title: string, name: string | RegExp) {
    return this.gameCard(title).getByRole(selectors.actions.gameButtonRole, { name, exact: typeof name === "string" });
  }

  detailsLink(title: string) {
    return this.gameCard(title).getByRole(selectors.actions.viewDetails.role, selectors.actions.viewDetails.options);
  }

  manageLink(title: string) {
    return this.gameCard(title).getByRole(selectors.actions.manageMatch.role, selectors.actions.manageMatch.options);
  }

  async openGame(title: string) {
    const card = this.gameCard(title);
    await Promise.all([
      this.page.waitForURL(/\/games\/[^/]+$/),
      card.getByRole(selectors.actions.viewDetails.role, selectors.actions.viewDetails.options).click()
    ]);
  }

  async joinFromCard(title: string) {
    await this.gameCard(title).getByRole(selectors.actions.joinMatch.role, selectors.actions.joinMatch.options).click();
  }

  async expectGameHidden(title: string) {
    await expect(this.gameCard(title)).toHaveCount(0);
  }

  async expectJoinedCount(title: string, value: string) {
    await expect(this.gameCard(title).getByTestId(selectors.joinedCount)).toHaveText(value);
  }

  async expectLevelMismatch(title: string, message: string) {
    const levelMismatch = this.gameCard(title).getByTestId(selectors.levelMismatch);
    await expect(levelMismatch).toContainText("Level mismatch");
    await expect(levelMismatch).toContainText(message);
  }
}
