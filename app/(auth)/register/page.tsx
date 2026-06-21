import { registerAction } from "@/app/actions";
import { CitySelect } from "@/components/city-select";
import { SubmitButton } from "@/components/submit-button";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";
import type { DictKey } from "@/lib/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Регистрация" : "Sign up" };
}

const errorKeys: Record<string, DictKey> = {
  email: "reg.err_email",
  "invalid-email": "reg.err_invalid_email",
  invalid: "reg.err_invalid"
};

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  const { t } = getT();
  const errorMessage = searchParams.error ? t(errorKeys[searchParams.error] ?? "reg.err_generic") : null;

  return (
    <div className="epci-card mx-auto max-w-xl">
      <h1 className="epci-page-title">{t("reg.title")}</h1>
      {errorMessage ? <p className="epci-alert-error mt-3" data-testid="register-error">{errorMessage}</p> : null}
      <form action={registerAction} className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="register-form">
        <label className="epci-label">
          {t("reg.name")} <span className="text-red-600">*</span>
          <input className="epci-field" name="name" required data-testid="register-name" />
        </label>
        <label className="epci-label">
          {t("reg.last_name")} <span className="text-red-600">*</span>
          <input className="epci-field" name="lastName" required data-testid="register-last-name" />
        </label>
        <label className="epci-label sm:col-span-2">
          {t("reg.email")} <span className="text-red-600">*</span>
          <input className="epci-field" name="email" type="email" required data-testid="register-email" />
        </label>
        <label className="epci-label sm:col-span-2">
          {t("reg.password")} <span className="text-red-600">*</span>
          <input className="epci-field" name="password" type="password" minLength={8} required data-testid="register-password" />
        </label>
        <label className="epci-label">
          {t("reg.phone")}
          <input className="epci-field" name="phone" data-testid="register-phone" />
        </label>
        <label className="epci-label">
          {t("reg.telegram")}
          <input className="epci-field" name="telegramUsername" data-testid="register-telegram" />
        </label>
        <div className="sm:col-span-2">
          <CitySelect name="city" label={t("reg.city")} testId="register-city" />
        </div>
        <SubmitButton className="epci-btn-primary sm:col-span-2" label={t("reg.submit")} testId="register-submit" />
      </form>
    </div>
  );
}
