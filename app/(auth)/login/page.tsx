import Link from "next/link";
import { loginAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Вход" : "Log in" };
}

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const { t } = getT();
  return (
    <div className="epci-card mx-auto max-w-md">
      <h1 className="epci-page-title">{t("login.title")}</h1>
      {searchParams.error ? (
        <p className="epci-alert-error mt-3" data-testid="login-error">
          {searchParams.error === "deactivated" ? t("login.err_deactivated") : t("login.err_credentials")}
        </p>
      ) : null}
      <form action={loginAction} className="mt-5 space-y-4" data-testid="login-form">
        <label className="epci-label">
          {t("login.email")}
          <input className="epci-field" name="email" type="email" required data-testid="login-email" />
        </label>
        <label className="epci-label">
          {t("login.password")}
          <input className="epci-field" name="password" type="password" required data-testid="login-password" />
        </label>
        <SubmitButton className="epci-btn-primary w-full" label={t("login.submit")} testId="login-submit" />
      </form>
      <p className="mt-4 text-sm">
        <Link className="font-black text-court" href="/forgot-password" data-testid="forgot-password-link">
          {t("login.forgot")}
        </Link>
      </p>
      <p className="mt-4 text-sm text-ink/60">
        {t("login.no_account")} <Link className="font-black text-court" href="/register">{t("login.register")}</Link>
      </p>
    </div>
  );
}
