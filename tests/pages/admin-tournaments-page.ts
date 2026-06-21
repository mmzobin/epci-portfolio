import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  createForm: "tournament-create-form",
  list: "admin-tournaments",
  participants: "tournament-participants",
  error: "tournament-error",
  success: "tournament-success",
  fields: {
    title: "tournament-title",
    startsAt: "tournament-startsAt",
    city: "tournament-city",
    club: "tournament-club"
  },
  create: "tournament-create",
  row: (title: string) => `admin-tournament-${title}`,
  addPlayerOption: (firstName: string) => `add-tournament-player-option-${firstName}`,
  addPlayer: "add-tournament-player",
  quickFill: {
    matches: "quick-fill-matches",
    apply: "quick-fill-apply"
  },
  result: {
    matches: (firstName: string) => `matches-${firstName}`,
    wins: (firstName: string) => `wins-${firstName}`,
    save: "save-results"
  },
  complete: "complete-tournament",
  participant: (firstName: string) => `tournament-participant-${firstName}`,
  points: (firstName: string) => `points-${firstName}`,
  status: "tournament-status",
  headings: {
    role: "heading",
    tournament: (title: string) => title
  }
} as const;

export class AdminTournamentsPage extends BasePage {
  readonly createForm: Locator;
  readonly list: Locator;
  readonly participants: Locator;
  readonly error: Locator;
  readonly success: Locator;
  readonly saveResultsButton: Locator

  constructor(page: Page) {
    super(page);
    this.createForm = this.testId(selectors.createForm);
    this.list = this.testId(selectors.list);
    this.participants = this.testId(selectors.participants);
    this.error = this.testId(selectors.error);
    this.success = this.testId(selectors.success);
    this .saveResultsButton = this.testId(selectors.result.save);
  }

  async goto() {
    await this.page.goto("/admin/tournaments");
    await expect(this.createForm).toBeVisible();
  }

  async createTournament(input: { title: string; startsAt?: string; city?: string; club?: string }) {
    await this.testId(selectors.fields.title).fill(input.title);
    if (input.startsAt) await this.testId(selectors.fields.startsAt).fill(input.startsAt);
    if (input.city) await this.testId(selectors.fields.city).selectOption(input.city);
    if (input.club) await this.testId(selectors.fields.club).selectOption({ label: input.club });
    await this.testId(selectors.create).click();
  }

  row(title: string) {
    return this.testId(selectors.row(title));
  }

  async addParticipants(...firstNames: string[]) {
    for (const firstName of firstNames) {
      await this.testId(selectors.addPlayerOption(firstName)).check();
    }
    await this.testId(selectors.addPlayer).click();
  }

  async quickFillMatches(value: string) {
    await this.testId(selectors.quickFill.matches).fill(value);
    await this.testId(selectors.quickFill.apply).click();
  }

  async fillResult(firstName: string, matches: string, wins: string) {
    await this.testId(selectors.result.matches(firstName)).fill(matches);
    await this.testId(selectors.result.wins(firstName)).fill(wins);
  }

  async saveResults() {
    await this.saveResultsButton.click();
  }

  async completeTournament() {
    await this.testId(selectors.complete).click();
  }

  participant(firstName: string) {
    return this.testId(selectors.participant(firstName));
  }

  points(firstName: string) {
    return this.testId(selectors.points(firstName));
  }

  status() {
    return this.testId(selectors.status);
  }

  async expectHeading(title: string, options?: { timeout?: number }) {
    await expect(this.page.getByRole(selectors.headings.role, { name: selectors.headings.tournament(title) })).toBeVisible(options);
  }
}
