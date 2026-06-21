import { expect, type Locator, type Page } from "@playwright/test";

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected testId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  async expectUrl(pathOrPattern: string | RegExp) {
    await expect(this.page).toHaveURL(pathOrPattern);
  }
}
