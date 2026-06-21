"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient, ensureSupabaseAuthUser, hasSupabaseAdminConfig } from "@/lib/supabase-admin";
import { createSupabaseServerClient, getAppUrl } from "@/lib/supabase";

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8);

export async function sendPasswordResetEmailAction(formData: FormData) {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  if (!emailResult.success) redirect("/forgot-password?error=email");

  const email = emailResult.data.toLowerCase();
  const redirectTo = `${getAppUrl()}/reset-password`;
  let errorParam: "config" | "rate-limit" | "send" | null = null;
  let shouldSendEmail = true;

  try {
    const localUser = await prisma.user.findUnique({ where: { email } });
    if (!localUser) {
      shouldSendEmail = false;
    } else {
      await ensureSupabaseAuthUser(email);
    }

    if (shouldSendEmail) {
      const supabase = createSupabaseServerClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        errorParam = error.status === 429 || error.code === "over_email_send_rate_limit" ? "rate-limit" : "send";
      }
    }
  } catch {
    errorParam = "config";
  }

  if (errorParam) redirect(`/forgot-password?error=${errorParam}`);
  redirect("/forgot-password?sent=1");
}

export async function syncRecoveredPasswordAction(input: { accessToken: string; password: string }) {
  const token = z.string().min(1).safeParse(input.accessToken);
  const password = passwordSchema.safeParse(input.password);

  if (!token.success || !password.success) {
    return { ok: false, message: "Password must contain at least 8 characters." };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser(token.data);

    if (error || !data.user?.email) {
      return { ok: false, message: "This reset link is invalid or has expired. Please request a new one." };
    }

    const email = data.user.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { ok: false, message: "We couldn’t find an account with this email." };
    }

    if (hasSupabaseAdminConfig()) {
      const supabaseAdmin = createSupabaseAdminClient();
      const { error: updateSupabaseError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        password: password.data
      });

      if (updateSupabaseError) {
        return { ok: false, message: "We couldn’t update your password. Please request a new link and try again." };
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password.data) }
    });

    return { ok: true, message: "Your password has been updated. You can now log in with your new password." };
  } catch {
    return { ok: false, message: "We couldn’t update your password. Please request a new link and try again." };
  }
}
