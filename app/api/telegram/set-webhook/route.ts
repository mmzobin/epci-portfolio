import { NextResponse } from "next/server";
import { setWebhook } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

/**
 * GET /api/telegram/set-webhook?secret=CRON_SECRET
 * One-time helper to register the bot webhook with Telegram.
 * Points Telegram at /api/telegram/webhook and uses TELEGRAM_WEBHOOK_SECRET
 * as the secret_token Telegram echoes back on every update.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  if (cronSecret && url.searchParams.get("secret") !== cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not set" }, { status: 500 });

  const result = await setWebhook(`${appUrl}/api/telegram/webhook`, process.env.TELEGRAM_WEBHOOK_SECRET);
  return NextResponse.json(result);
}
