"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { syncRecoveredPasswordAction } from "@/app/(auth)/password-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

type Status = "checking" | "ready" | "success" | "error";

function cleanRecoveryUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

export function ResetPasswordForm({ isConfigured }: { isConfigured: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>(isConfigured ? "checking" : "error");
  const [message, setMessage] = useState(isConfigured ? t("rp.checking") : t("rp.not_available"));
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const supabase = useMemo(() => {
    if (!isConfigured) return null;
    return createSupabaseBrowserClient({ detectSessionInUrl: false });
  }, [isConfigured]);

  useEffect(() => {
    if (!supabase) return;

    const client = supabase;
    let isMounted = true;

    function acceptRecoverySession(token?: string) {
      if (!isMounted || !token) return false;
      setAccessToken(token);
      setStatus("ready");
      setMessage(t("rp.enter"));
      cleanRecoveryUrl();
      return true;
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") acceptRecoverySession(session?.access_token);
    });

    async function restoreRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const queryType = url.searchParams.get("type");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashType = hashParams.get("type");
      const accessTokenFromHash = hashParams.get("access_token");
      const refreshTokenFromHash = hashParams.get("refresh_token");

      if (code) {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (!error && acceptRecoverySession(data.session?.access_token)) return;
      } else if (tokenHash && queryType === "recovery") {
        const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!error && acceptRecoverySession(data.session?.access_token)) return;
      } else if (hashType === "recovery" && accessTokenFromHash && refreshTokenFromHash) {
        const { data, error } = await client.auth.setSession({
          access_token: accessTokenFromHash,
          refresh_token: refreshTokenFromHash
        });
        if (!error && acceptRecoverySession(data.session?.access_token)) return;
      }

      if (!isMounted) return;
      setStatus("error");
      setMessage(t("rp.invalid_link"));
    }

    restoreRecoverySession();

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, t]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    if (!supabase || !accessToken) {
      setStatus("error");
      setMessage(t("rp.invalid_link"));
      return;
    }

    if (password.length < 8) {
      setStatus("ready");
      setMessage(t("rp.too_short"));
      return;
    }

    if (password !== confirmation) {
      setStatus("ready");
      setMessage(t("rp.mismatch"));
      return;
    }

    startTransition(async () => {
      const result = await syncRecoveredPasswordAction({ accessToken, password });
      setMessage(result.message);
      setStatus(result.ok ? "success" : "error");
      setPassword("");
      setConfirmation("");
      if (result.ok) await supabase.auth.signOut();
    });
  }

  return (
    <>
      <p className={`mt-3 rounded-lg border p-3 text-sm font-medium ${status === "success" ? "border-green-200 bg-green-50 text-green-800" : status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-line bg-court-soft text-ink/70"}`}>
        {message}
      </p>
      {status === "ready" ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4" data-testid="reset-password-form">
          <label className="epci-label">
            {t("rp.new")}
            <input
              className="epci-field"
              type="password"
              minLength={8}
              required
              disabled={isPending}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="reset-password-new"
            />
          </label>
          <label className="epci-label">
            {t("rp.confirm")}
            <input
              className="epci-field"
              type="password"
              minLength={8}
              required
              disabled={isPending}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              data-testid="reset-password-confirmation"
            />
          </label>
          <button className="epci-btn-primary relative w-full" disabled={isPending} data-testid="reset-password-submit" aria-busy={isPending}>
            <span className={isPending ? "invisible" : undefined}>{t("rp.save")}</span>
            {isPending ? (
              <span className="absolute inset-0 grid place-items-center">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
                <span className="sr-only">{t("common.loading")}</span>
              </span>
            ) : null}
          </button>
        </form>
      ) : null}
      {status === "success" ? (
        <Link className="epci-btn-primary mt-5 w-full" href="/login" data-testid="reset-password-login">
          {t("rp.go_login")}
        </Link>
      ) : null}
      {status === "error" ? (
        <Link className="mt-4 block text-sm font-black text-court" href="/forgot-password">
          {t("rp.request_new")}
        </Link>
      ) : null}
    </>
  );
}
