import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { HeaderManageMenu } from "@/components/header-manage-menu";
import { HeaderNavLink } from "@/components/header-nav-link";
import { LangToggle } from "@/components/lang-toggle";
import { TelegramProvider } from "@/components/telegram-provider";
import { UserMenu } from "@/components/user-menu";
import { LangProvider } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/server-i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EPCI | Exclusive Padel Crew Israel",
    template: "%s · EPCI"
  },
  description: "Find games, join tournaments, and connect with padel players across Israel."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#07150d"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const { lang, t } = getT();

  return (
    <html lang={lang}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        <LangProvider initialLang={lang}>
        <TelegramProvider authenticated={Boolean(user)} />
        <header className="epci-header sticky top-0 z-20 text-white">
          <nav className="epci-shell grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Link href="/" className="group flex min-w-0 items-center gap-3 justify-self-start font-black text-white outline-none" data-testid="nav-home">
              <Image
                src="/brand/epci-icon.png"
                alt="Exclusive Padel Crew Israel"
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl border border-white/25 object-cover shadow-[0_10px_22px_rgba(0,0,0,0.28)] ring-1 ring-white/15 transition group-hover:border-limeball/45 group-focus-visible:ring-2 group-focus-visible:ring-limeball/70"
                priority
              />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-lg">EPCI</span>
                <span className="hidden truncate text-xs font-semibold text-white/65 sm:block">{t("brand.tagline")}</span>
              </span>
            </Link>
            <div className="order-3 col-span-2 flex flex-wrap items-center justify-center gap-1.5 text-sm lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1">
              {user ? (
                <>
                  <HeaderNavLink href="/ranking" testId="nav-ranking">
                    {t("nav.ranking")}
                  </HeaderNavLink>
                  <HeaderNavLink href="/tournaments" testId="nav-tournaments">
                    {t("nav.tournaments")}
                  </HeaderNavLink>
                  {["ORGANIZER", "ADMIN"].includes(user.role) ? (
                    <HeaderNavLink href="/organizer" testId="nav-organizer">
                      {t("nav.manage_games")}
                    </HeaderNavLink>
                  ) : null}
                  {user.role === "ADMIN" ? <HeaderManageMenu /> : null}
                </>
              ) : (
                <HeaderNavLink href="/login" testId="nav-login">
                  {t("nav.login")}
                </HeaderNavLink>
              )}
            </div>
            <div className="flex items-center gap-2 justify-self-end lg:col-start-3 lg:row-start-1">
              <LangToggle />
              {user ? (
                <UserMenu user={user} />
              ) : (
                <Link className="epci-btn-primary px-3 py-2 focus-visible:ring-offset-court-dark" href="/register" data-testid="nav-register">
                  {t("nav.signup")}
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="epci-shell py-8">{children}</main>
        </LangProvider>
      </body>
    </html>
  );
}
