import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";
import { testPassword } from "../data/test-data";

export const selectors = {
  form: "register-form",
  error: "register-error",
  assessmentResult: "assessment-result",
  saveAssessment: "save-assessment",
  fields: {
    name: "register-name",
    lastName: "register-last-name",
    email: "register-email",
    password: "register-password",
    phone: "register-phone",
    telegram: "register-telegram",
    city: "register-city"
  },
  submit: "register-submit",
  // These option indices sum to 53 points → level 3.50 (see lib/level-assessment).
  assessment: {
    headingRole: "heading",
    heading: "Determine Your Playing Level",
    self: "assessment-self-3",
    experience: "assessment-experience-3",
    frequency: "assessment-frequency-2",
    volume: "assessment-volume-2",
    serve: "assessment-serve-1",
    rally: "assessment-rally-1",
    walls: "assessment-walls-1",
    attack: "assessment-attack-1",
    tactics: "assessment-tactics-1",
    tournaments: "assessment-tournaments-1",
    competition: "assessment-competition-1",
    calculate: "calculate-assessment"
  }
} as const;

type RegistrationInput = {
  name: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  telegram?: string;
  city?: string;
};

export class RegisterPage extends BasePage {
  readonly form: Locator;
  readonly error: Locator;
  readonly assessmentResult: Locator;
  readonly saveAssessment: Locator;

  constructor(page: Page) {
    super(page);
    this.form = this.testId(selectors.form);
    this.error = this.testId(selectors.error);
    this.assessmentResult = this.testId(selectors.assessmentResult);
    this.saveAssessment = this.testId(selectors.saveAssessment);
  }

  async goto() {
    await this.page.goto("/register");
    await expect(this.form).toBeVisible();
  }

  async register(input: RegistrationInput) {
    await this.goto();
    await this.testId(selectors.fields.name).fill(input.name);
    await this.testId(selectors.fields.lastName).fill(input.lastName);
    await this.testId(selectors.fields.email).fill(input.email);
    await this.testId(selectors.fields.password).fill(input.password ?? testPassword);
    if (input.phone) await this.testId(selectors.fields.phone).fill(input.phone);
    if (input.telegram) await this.testId(selectors.fields.telegram).fill(input.telegram);
    if (input.city) await this.testId(selectors.fields.city).fill(input.city);
    await this.testId(selectors.submit).click();
  }

  async expectError(message: string | RegExp) {
    await expect(this.error).toContainText(message);
  }

  async completeLevelAssessment() {
    await expect(this.page.getByRole(selectors.assessment.headingRole, { name: selectors.assessment.heading })).toBeVisible();
    await this.testId(selectors.assessment.self).check();
    await this.testId(selectors.assessment.experience).check();
    await this.testId(selectors.assessment.frequency).check();
    await this.testId(selectors.assessment.volume).check();
    await this.testId(selectors.assessment.serve).check();
    await this.testId(selectors.assessment.rally).check();
    await this.testId(selectors.assessment.walls).check();
    await this.testId(selectors.assessment.attack).check();
    await this.testId(selectors.assessment.tactics).check();
    await this.testId(selectors.assessment.tournaments).check();
    await this.testId(selectors.assessment.competition).check();
    await this.testId(selectors.assessment.calculate).click();
  }
}
