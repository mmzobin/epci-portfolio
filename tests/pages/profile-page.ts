import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

export const selectors = {
  card: "profile-card",
  rating: "profile-rating",
  editForm: "profile-edit",
  error: "profile-error",
  success: "profile-success",
  fields: {
    name: "profile-edit-name",
    lastName: "profile-edit-last-name",
    city: "profile-edit-city",
    phone: "profile-edit-phone",
    telegram: "profile-edit-telegram"
  },
  save: "profile-edit-save"
} as const;

export class ProfilePage extends BasePage {
  readonly card: Locator;
  readonly editForm: Locator;
  readonly error: Locator;
  readonly success: Locator;
  readonly rating: Locator;

  constructor(page: Page) {
    super(page);
    this.card = this.testId(selectors.card);
    this.editForm = this.testId(selectors.editForm);
    this.error = this.testId(selectors.error);
    this.success = this.testId(selectors.success);
    this.rating = this.testId(selectors.rating);
  }

  async goto() {
    await this.page.goto("/profile");
    await expect(this.card).toBeVisible();
  }

  async updateProfile(input: { name?: string; lastName?: string; city?: string; phone?: string; telegram?: string }) {
    if (input.name) await this.testId(selectors.fields.name).fill(input.name);
    if (input.lastName) await this.testId(selectors.fields.lastName).fill(input.lastName);
    if (input.city) await this.testId(selectors.fields.city).selectOption(input.city);
    if (input.phone) await this.testId(selectors.fields.phone).fill(input.phone);
    if (input.telegram) await this.testId(selectors.fields.telegram).fill(input.telegram);
    await this.testId(selectors.save).click();
  }

  async expectProfileContains(...values: string[]) {
    for (const value of values) {
      await expect(this.card).toContainText(value);
    }
  }

  async expectEditFormValues(input: { name?: string; lastName?: string; city?: string; phone?: string; telegram?: string }) {
    if (input.name) await expect(this.testId(selectors.fields.name)).toHaveValue(input.name);
    if (input.lastName) await expect(this.testId(selectors.fields.lastName)).toHaveValue(input.lastName);
    if (input.city) await expect(this.testId(selectors.fields.city)).toHaveValue(input.city);
    if (input.phone) await expect(this.testId(selectors.fields.phone)).toHaveValue(input.phone);
    if (input.telegram) await expect(this.testId(selectors.fields.telegram)).toHaveValue(input.telegram);
  }
}
