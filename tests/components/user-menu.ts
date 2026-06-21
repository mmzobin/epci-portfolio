import { expect, type Locator, type Page } from "@playwright/test";

export const selectors = {
  avatarButton: "avatar-menu-button",
  logoutButton: "logout-button",
  profileLink: "nav-profile",
  loginLink: "nav-login"
} as const;

export class UserMenu {
  readonly avatarButton: Locator;
  readonly logoutButton: Locator;
  readonly profileLink: Locator;

  constructor(private readonly page: Page) {
    this.avatarButton = this.page.getByTestId(selectors.avatarButton);
    this.logoutButton = this.page.getByTestId(selectors.logoutButton);
    this.profileLink = this.page.getByTestId(selectors.profileLink);
  }

  async open() {
    await this.avatarButton.click();
  }

  async hoverAvatar() {
    await this.avatarButton.hover();
  }

  async logout() {
    await this.open();
    await this.logoutButton.click();
    await expect(this.page).toHaveURL(/\/$/);
    await expect(this.page.getByTestId(selectors.loginLink)).toBeVisible();
  }
}
