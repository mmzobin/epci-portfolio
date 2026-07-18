import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  newGameLink: "new-game-link",
  participants: "organizer-participants",
  error: "organizer-game-error",
  success: "organizer-game-success",
  gameRow: (title: string) => `organizer-game-${title}`,
  manageMatch: { role: "link", options: { name: "Manage Match", exact: true } },
  fields: {
    title: "game-title",
    startsAt: "game-startsAt",
    city: "game-city",
    club: "game-club",
    address: "game-address",
    courtPrice: "game-court-price",
    courtNumber: "game-courtNumber",
    maxPlayers: "game-maxPlayers",
    minLevel: "game-minLevel",
    maxLevel: "game-maxLevel"
  },
  checkedOption: "option:checked",
  save: "game-save",
  status: "game-status",
  matchBadge: (label: string) => `match-badge-${label}`,
  gameAction: (action: "open" | "cancel" | "complete") => `${action}-game`,
  settlementAction: (action: "paid" | "no-show", firstName: string) => `${action}-${firstName}`,
  participantAction: (action: "paid" | "unpaid" | "played" | "no-show" | "join-waiting", firstName: string) =>
    `${action}-${firstName}`,
  adminAddPlayer: {
    search: "admin-add-player-search",
    option: (firstName: string) => `admin-add-player-option-${firstName}`,
    button: "admin-add-player-button"
  },
  headings: {
    role: "heading",
    game: (title: string) => title
  },
  messages: {
    detailsSaved: "Game details saved.",
    pastDate: "Match date and time cannot be in the past.",
    levelRange: "Your level 3.5 doesn't match this game's required level range: 3.0-3.0.",
    statusLabel: "Status:"
  }
} as const;

export class OrganizerPage extends BasePage {
  readonly newGameLink: Locator;
  readonly participants: Locator;
  readonly error: Locator;
  readonly success: Locator;
  readonly status: Locator

  constructor(page: Page) {
    super(page);
    this.newGameLink = this.testId(selectors.newGameLink);
    this.participants = this.testId(selectors.participants);
    this.error = this.testId(selectors.error);
    this.success = this.testId(selectors.success);
    this.status = this.testId(selectors.status);
  }

  async goto() {
    await this.page.goto("/organizer");
    await expect(this.newGameLink).toBeVisible();
  }

    async gotoNegative() {
    await this.page.goto("/organizer");
    await expect(this.page).not.toHaveURL(/\/organizer\$/);
  }

  gameRow(title: string) {
    return this.testId(selectors.gameRow(title));
  }

  gameRowBadge(title: string, label: string) {
    return this.gameRow(title).getByTestId(selectors.matchBadge(label));
  }

  async expectGameRowBadge(title: string, label: string) {
    await expect(this.gameRowBadge(title, label)).toBeVisible();
  }

  async openGame(title: string) {
    await Promise.all([
      this.page.waitForURL(/\/organizer\/games\/[^/]+$/),
      this.gameRow(title).getByRole(selectors.manageMatch.role, selectors.manageMatch.options).click()
    ]);
  }

  async createGame(input: {
    title: string;
    startsAt: string;
    city?: string;
    clubLabel?: string;
    courtNumber?: string;
    maxPlayers?: string;
  }) {
    await this.newGameLink.click();
    await this.testId(selectors.fields.title).fill(input.title);
    await this.testId(selectors.fields.startsAt).fill(input.startsAt);
    if (input.city) await this.testId(selectors.fields.city).selectOption(input.city);
    if (input.clubLabel) await this.testId(selectors.fields.club).selectOption({ label: input.clubLabel });
    if (input.courtNumber) await this.testId(selectors.fields.courtNumber).fill(input.courtNumber);
    if (input.maxPlayers) await this.testId(selectors.fields.maxPlayers).fill(input.maxPlayers);
    await this.testId(selectors.save).click();
  }

  async createGameAndExpectSuccess(input: Parameters<OrganizerPage["createGame"]>[0]) {
    await Promise.all([
      this.page.waitForURL(/\/organizer\/games\/[^/]+\?saved=created$/),
      this.createGame(input)
    ]);
  }

  async expectStatus(status: string) {
    await expect(this.testId(selectors.status)).toHaveText(status);
  }

  badge(label: string) {
    return this.testId(selectors.matchBadge(label));
  }

  async expectBadge(label: string) {
    await expect(this.badge(label)).toBeVisible();
  }

  gameAction(action: "open" | "cancel" | "complete") {
    return this.testId(selectors.gameAction(action));
  }

  async expectParticipantText(text: string | RegExp) {
    await expect(this.participants).toContainText(text);
  }

  async expectParticipantTextAbsent(text: string | RegExp) {
    await expect(this.participants).not.toContainText(text);
  }

  async expectSettlementActionHidden(action: "paid" | "no-show", firstName: string) {
    await expect(this.testId(selectors.settlementAction(action, firstName))).toHaveCount(0);
  }

  async setMaxLevel(level: string) {
    await this.testId(selectors.fields.maxLevel).selectOption(level);
    await Promise.all([
      this.page.waitForURL(/\/organizer\/games\/[^/]+\?saved=game$/),
      this.testId(selectors.save).click()
    ]);
    await expect(this.success).toHaveText(selectors.messages.detailsSaved);
  }

  async addPlayer(firstName: string) {
    await expect(this.testId(selectors.adminAddPlayer.search)).toBeVisible();
    await this.testId(selectors.adminAddPlayer.search).fill(firstName);
    await this.testId(selectors.adminAddPlayer.option(firstName)).check();
    await this.testId(selectors.adminAddPlayer.button).click();
  }

  async markPaid(firstName: string) {
    await this.testId(selectors.participantAction("paid", firstName)).click();
  }

  async markUnpaid(firstName: string) {
    await this.testId(selectors.participantAction("unpaid", firstName)).click();
  }

  async approveWaiting(firstName: string) {
    await this.testId(selectors.participantAction("join-waiting", firstName)).click();
  }

  async markNoShow(firstName: string) {
    await this.testId(selectors.participantAction("no-show", firstName)).click();
  }

  async markPlayed(firstName: string) {
    await this.testId(selectors.participantAction("played", firstName)).click();
  }

  async updateGame(input: {
    title?: string;
    startsAt?: string;
    city?: string;
    clubLabel?: string;
    courtPrice?: string;
    courtNumber?: string;
    maxPlayers?: string;
    minLevel?: string;
    maxLevel?: string;
  }) {
    if (input.title) await this.testId(selectors.fields.title).fill(input.title);
    if (input.startsAt) await this.testId(selectors.fields.startsAt).fill(input.startsAt);
    if (input.city) await this.testId(selectors.fields.city).selectOption(input.city);
    if (input.clubLabel) await this.testId(selectors.fields.club).selectOption({ label: input.clubLabel });
    if (input.courtPrice) await this.testId(selectors.fields.courtPrice).fill(input.courtPrice);
    if (input.courtNumber) await this.testId(selectors.fields.courtNumber).fill(input.courtNumber);
    if (input.maxPlayers) await this.testId(selectors.fields.maxPlayers).fill(input.maxPlayers);
    if (input.minLevel) await this.testId(selectors.fields.minLevel).selectOption(input.minLevel);
    if (input.maxLevel) await this.testId(selectors.fields.maxLevel).selectOption(input.maxLevel);

    await Promise.all([
      this.page.waitForURL(/\/organizer\/games\/[^/]+\?saved=game$/),
      this.testId(selectors.save).click()
    ]);
    await expect(this.success).toHaveText(selectors.messages.detailsSaved);
  }

  async expectGameHeading(title: string) {
    await expect(this.page.getByRole(selectors.headings.role, { name: selectors.headings.game(title) })).toBeVisible();
  }

  async expectPastDateError() {
    await expect(this.page.getByText(selectors.messages.pastDate)).toBeVisible();
  }

  async expectStatusLabelVisible() {
    await expect(this.page.getByText(selectors.messages.statusLabel)).toBeVisible();
  }

  async expectLevelRangeError() {
    await expect(this.page.getByText(selectors.messages.levelRange)).toBeVisible();
  }

  async cancelGame() {
    await Promise.all([
      this.page.waitForURL(/\/organizer\/games\/[^/]+\?saved=status$/),
      this.gameAction("cancel").click()
    ])
  }

  async completeGame() {
    await Promise.all([
      this.page.waitForURL(/\/organizer\/games\/[^/]+\?saved=status$/),
      this.gameAction("complete").click()
    ])
  }

  field(name: keyof typeof selectors.fields) {
    return this.testId(selectors.fields[name]);
  }

  selectedClub() {
    return this.testId(selectors.fields.club).locator(selectors.checkedOption);
  }

  async expectAddPlayerOptionHidden(firstName: string) {
    await expect(this.testId(selectors.adminAddPlayer.option(firstName))).toHaveCount(0);
  }
}
