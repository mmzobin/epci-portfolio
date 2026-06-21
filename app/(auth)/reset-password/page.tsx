import { hasSupabaseConfig } from "@/lib/supabase";
import type { Metadata } from "next";
import { getT } from "@/lib/server-i18n";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = getT();
  return { title: lang === "ru" ? "Новый пароль" : "Set new password" };
}

export default function ResetPasswordPage() {
  const { t } = getT();
  return (
    <div className="epci-card mx-auto max-w-md">
      <h1 className="epci-page-title">{t("rp.title")}</h1>
      <ResetPasswordForm isConfigured={hasSupabaseConfig()} />
    </div>
  );
}
