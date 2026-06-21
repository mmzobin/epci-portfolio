import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";
import page from "@/app/organizer/games/new/page";

export const selectors = {
  table: "admin-users",
  error: "admin-users-error",
  success: "admin-users-success",
  row: (email: string) => `admin-user-${email}`,
  roleSelect: (email: string) => `role-select-${email}`,
  roleSave: (email: string) => `role-save-${email}`
} as const;

export class AdminUsersPage extends BasePage {
  readonly table: Locator;
  readonly error: Locator;
  readonly success: Locator;

  constructor(page: Page) {
    super(page);
    this.table = this.testId(selectors.table);
    this.error = this.testId(selectors.error);
    this.success = this.testId(selectors.success);
  }

  async goto() {
    await this.page.goto("/admin/users");
    await expect(this.table).toBeVisible();
  }

    async gotoNegative() {
    await this.page.goto("/admin/users");
    await expect(this.page).not.toHaveURL(/\/admin\/users$/);
  }

  row(email: string) {
    return this.testId(selectors.row(email));
  }

  async changeRole(email: string, role: "PLAYER" | "ORGANIZER" | "ADMIN") {
    await this.testId(selectors.roleSelect(email)).selectOption(role);
    await this.testId(selectors.roleSave(email)).click();
  }
}
