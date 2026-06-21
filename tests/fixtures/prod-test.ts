import { expect, test as base, type Page } from "@playwright/test";
import { HomePage } from "../pages/home-page";
import { LoginPage } from "../pages/login-page";
import { RankingPage } from "../pages/ranking-page";
import { RegisterPage } from "../pages/register-page";

type ProdFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  rankingPage: RankingPage;
  registerPage: RegisterPage;
};

export const test = base.extend<ProdFixtures>({
  page: async ({ page }, use) => {
    page.on("dialog", (dialog) => dialog.accept());
    await use(page);
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  rankingPage: async ({ page }, use) => {
    await use(new RankingPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  }
});

export { expect, type Page };
