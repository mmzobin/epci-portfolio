import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  list: "clubs-list",
  createForm: "club-create-form",
  error: "club-error",
  success: "club-success",
  row: (name: string) => `club-row-${name}`,
  fields: {
    name: "club-name",
    city: "club-city",
    address: "club-address",
    price: "club-price"
  },
  create: "club-create"
} as const;

export class AdminClubsPage extends BasePage {
  readonly list: Locator;
  readonly createForm: Locator;
  readonly error: Locator;
  readonly success: Locator;

  constructor(page: Page) {
    super(page);
    this.list = this.testId(selectors.list);
    this.createForm = this.testId(selectors.createForm);
    this.error = this.testId(selectors.error);
    this.success = this.testId(selectors.success);
  }

  async goto() {
    await this.page.goto("/admin/clubs");
    await expect(this.createForm).toBeVisible();
  }

  row(name: string) {
    return this.testId(selectors.row(name));
  }

  async createClub(input: { name: string; city: string; address: string; price: string }) {
    await this.testId(selectors.fields.name).fill(input.name);
    await this.testId(selectors.fields.city).fill(input.city);
    await this.testId(selectors.fields.address).fill(input.address);
    await this.testId(selectors.fields.price).fill(input.price);
    await this.testId(selectors.create).click();
  }
}
