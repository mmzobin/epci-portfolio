import Link from "next/link";
import { sendPasswordResetEmailAction } from "@/app/(auth)/password-actions";
import { SubmitButton } from "@/components/submit-button";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Забыли пароль" : "Forgot password" };
}

export default function ForgotPasswordPage({ searchParams }: { searchParams: { error?: string; sent?: string } }) {
  const { t } = getT();
  const isSent = searchParams.sent === "1";
  const errorText = searchParams.error === "email"
    ? t("fp.err_email")
    : searchParams.error === "config"
      ? t("fp.err_config")
      : searchParams.error === "rate-limit"
        ? t("fp.err_rate")
      : searchParams.error === "send"
        ? t("fp.err_send")
      : null;

  return (
    <div className="epci-card mx-auto max-w-md">
      <h1 className="epci-page-title">{t("fp.title")}</h1>
      <p className="mt-3 text-sm text-ink/60">{t("fp.subtitle")}</p>
      {isSent ? <p className="epci-alert-success mt-3">{t("fp.sent")}</p> : null}
      {errorText ? <p className="epci-alert-error mt-3">{errorText}</p> : null}
      <form action={sendPasswordResetEmailAction} className="mt-5 space-y-4" data-testid="forgot-password-form">
        <label className="epci-label">
          {t("fp.email")}
          <input className="epci-field" name="email" type="email" required data-testid="forgot-password-email" />
        </label>
        <SubmitButton className="epci-btn-primary w-full" label={t("fp.submit")} testId="forgot-password-submit" />
      </form>
      <p className="mt-4 text-sm text-ink/60">
        {t("fp.remember")} <Link className="font-black text-court" href="/login">{t("fp.login")}</Link>
      </p>
    </div>
  );
}
