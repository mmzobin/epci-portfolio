import { expect, type Locator, type Page } from "@playwright/test";

export const selectors = {
  nav: {
    home: "nav-home",
    ranking: "nav-ranking",
    tournaments: "nav-tournaments",
    organizer: "nav-organizer",
    login: "nav-login",
    register: "nav-register",
    manage: "nav-manage",
    adminUsers: "nav-admin",
    adminClubs: "nav-admin-clubs",
    adminTournaments: "nav-admin-tournaments"
  },
  ready: {
    home: "games-list",
    games: "new-game-link",
    ranking: "ranking-list",
    tournaments: "tournaments-list",
    login: "login-form",
    register: "register-form",
    adminUsers: "admin-users",
    adminClubs: "club-create-form",
    adminTournaments: "tournament-create-form",
    manageMenu: "manage-menu"
  }
} as const;

export class Header {
  readonly homeLink: Locator;
  readonly rankingLink: Locator;
  readonly tournamentsLink: Locator;
  readonly gamesLink: Locator;
  readonly loginLink: Locator;
  readonly registerLink: Locator;
  readonly manageButton: Locator;
  readonly adminUsersLink: Locator;
  readonly adminClubsLink: Locator;
  readonly adminTournamentsLink: Locator;

  constructor(private readonly page: Page) {
    this.homeLink = this.page.getByTestId(selectors.nav.home);
    this.rankingLink = this.page.getByTestId(selectors.nav.ranking);
    this.tournamentsLink = this.page.getByTestId(selectors.nav.tournaments);
    this.gamesLink = this.page.getByTestId(selectors.nav.organizer);
    this.loginLink = this.page.getByTestId(selectors.nav.login);
    this.registerLink = this.page.getByTestId(selectors.nav.register);
    this.manageButton = this.page.getByTestId(selectors.nav.manage);
    this.adminUsersLink = this.page.getByTestId(selectors.nav.adminUsers);
    this.adminClubsLink = this.page.getByTestId(selectors.nav.adminClubs);
    this.adminTournamentsLink = this.page.getByTestId(selectors.nav.adminTournaments);
  }

  async openHome() {
    await this.openPage(this.homeLink, /\/$/, this.page.getByTestId(selectors.ready.home), "attached");
  }

  async openGames() {
    await this.openPage(this.gamesLink, /\/organizer$/, this.page.getByTestId(selectors.ready.games));
  }

  async openRanking() {
    await this.openPage(this.rankingLink, /\/ranking$/, this.page.getByTestId(selectors.ready.ranking));
  }

  async openTournaments() {
    await this.openPage(this.tournamentsLink, /\/tournaments$/, this.page.getByTestId(selectors.ready.tournaments), "attached");
  }

  async openLogin() {
    await this.openPage(this.loginLink, /\/login$/, this.page.getByTestId(selectors.ready.login));
  }

  async openRegister() {
    await this.openPage(this.registerLink, /\/register$/, this.page.getByTestId(selectors.ready.register));
  }

  async openAdminUsers() {
    await this.openManageMenu();
    await this.openPage(this.adminUsersLink, /\/admin\/users$/, this.page.getByTestId(selectors.ready.adminUsers));
  }

  async openAdminClubs() {
    await this.openManageMenu();
    await this.openPage(this.adminClubsLink, /\/admin\/clubs$/, this.page.getByTestId(selectors.ready.adminClubs));
  }

  async openAdminTournaments() {
    await this.openManageMenu();
    await this.openPage(this.adminTournamentsLink, /\/admin\/tournaments$/, this.page.getByTestId(selectors.ready.adminTournaments));
  }

  async openManageMenu() {
    await this.manageButton.click();
    await expect(this.page.getByTestId(selectors.ready.manageMenu)).toBeVisible();
  }

  private async openPage(link: Locator, url: RegExp, pageReady: Locator, state: "visible" | "attached" = "visible") {
    await Promise.all([this.page.waitForURL(url), link.click()]);
    await expect(this.page).toHaveURL(url);

    if (state === "attached") {
      await expect(pageReady).toBeAttached();
      return;
    }

    await expect(pageReady).toBeVisible();
  }
}
