import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { Header } from "../components/header";
import { UserMenu } from "../components/user-menu";
import { AdminClubsPage } from "../pages/admin-clubs-page";
import { AdminTournamentsPage } from "../pages/admin-tournaments-page";
import { AdminUsersPage } from "../pages/admin-users-page";
import { GameDetailsPage } from "../pages/game-details-page";
import { HomePage } from "../pages/home-page";
import { LoginPage } from "../pages/login-page";
import { OrganizerPage } from "../pages/organizer-page";
import { ProfilePage } from "../pages/profile-page";
import { RankingPage } from "../pages/ranking-page";
import { RegisterPage } from "../pages/register-page";

type AppFixtures = {
  adminClubsPage: AdminClubsPage;
  adminTournamentsPage: AdminTournamentsPage;
  adminUsersPage: AdminUsersPage;
  gameDetailsPage: GameDetailsPage;
  header: Header;
  homePage: HomePage;
  loginPage: LoginPage;
  organizerPage: OrganizerPage;
  profilePage: ProfilePage;
  rankingPage: RankingPage;
  registerPage: RegisterPage;
  resetApp: () => Promise<void>;
  userMenu: UserMenu;
};

async function resetApp(request: APIRequestContext) {
  const response = await request.post("/api/test/reset", {
    headers: { "x-test-token": process.env.TEST_RESET_TOKEN ?? "local-test-token" }
  });
  const body = await response.text();
  expect(response.ok(), `POST /api/test/reset failed with ${response.status()} ${response.statusText()}: ${body}`).toBeTruthy();
}

export const test = base.extend<AppFixtures>({
  resetApp: async ({ request }, use) => {
    await use(() => resetApp(request));
  },
  page: async ({ page, request }, use) => {
    page.on("dialog", (dialog) => dialog.accept());
    await resetApp(request);
    await use(page);
  },
  adminClubsPage: async ({ page }, use) => {
    await use(new AdminClubsPage(page));
  },
  adminTournamentsPage: async ({ page }, use) => {
    await use(new AdminTournamentsPage(page));
  },
  adminUsersPage: async ({ page }, use) => {
    await use(new AdminUsersPage(page));
  },
  gameDetailsPage: async ({ page }, use) => {
    await use(new GameDetailsPage(page));
  },
  header: async ({ page }, use) => {
    await use(new Header(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  organizerPage: async ({ page }, use) => {
    await use(new OrganizerPage(page));
  },
  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
  rankingPage: async ({ page }, use) => {
    await use(new RankingPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  userMenu: async ({ page }, use) => {
    await use(new UserMenu(page));
  }
});

export { expect, type Page };
