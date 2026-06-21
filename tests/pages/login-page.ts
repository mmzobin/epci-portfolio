import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";
import { testPassword } from "../data/test-data";

export const selectors = {
  form: "login-form",
  email: "login-email",
  password: "login-password",
  submit: "login-submit",
  error: "login-error",
  gamesList: "games-list",
  forgotPasswordLink: "forgot-password-link",
  forgotPasswordForm: "forgot-password-form",
  headings: {
    role: "heading",
    resetPassword: "Reset Password"
  }
} as const;

export class LoginPage extends BasePage {
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly forgotPasswordLink: Locator;
  readonly forgotPasswordForm: Locator;

  constructor(page: Page) {
    super(page);
    this.form = this.testId(selectors.form);
    this.email = this.testId(selectors.email);
    this.password = this.testId(selectors.password);
    this.submit = this.testId(selectors.submit);
    this.error = this.testId(selectors.error);
    this.forgotPasswordLink = this.testId(selectors.forgotPasswordLink);
    this.forgotPasswordForm = this.testId(selectors.forgotPasswordForm);
  }

  async goto() {
    await this.page.goto("/login");
    await expect(this.form).toBeVisible();
  }

  async loginAs(email: string, password = testPassword) {
    await this.goto();
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async loginAndExpectHome(email: string, password = testPassword) {
    await this.loginAs(email, password);
    await expect(this.testId(selectors.gamesList)).toBeVisible({ timeout: 60_000 });
  }

  async expectInvalidCredentials() {
    await expect(this.error).toContainText("Incorrect email or password.");
  }

  async openPasswordRecovery() {
    await this.forgotPasswordLink.click();
  }

  async expectPasswordRecoveryVisible() {
    await expect(this.page.getByRole(selectors.headings.role, { name: selectors.headings.resetPassword })).toBeVisible();
    await expect(this.forgotPasswordForm).toBeVisible();
  }
}
