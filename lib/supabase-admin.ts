import "server-only";

import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabaseAdminConfig() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

export function createSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase admin config is missing");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

export async function ensureSupabaseAuthUser(email: string) {
  if (!hasSupabaseAdminConfig()) return;

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const exists = data.users.some((user) => user.email?.toLowerCase() === normalizedEmail);
    if (exists) return;
    if (data.users.length < 1000) break;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true
  });

  if (error) throw error;
}
