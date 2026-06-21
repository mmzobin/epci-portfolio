import crypto from "crypto";
import { NextResponse } from "next/server";
import { hashPassword, setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeLang, parseTelegramUser } from "@/lib/telegram-auth";

/**
 * POST /api/telegram/auth
 * Body: { initData: string }  (the raw Telegram.WebApp.initData string)
 *
 * Validates the Telegram signature, finds-or-creates a matching local user,
 * and sets the existing `padel_session` cookie. Returns where the client
 * should go next (level assessment for brand new players).
 */
export async function POST(request: Request) {
  let initData = "";
  try {
    const body = (await request.json()) as { initData?: string };
    initData = body.initData ?? "";
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    // Misconfiguration shouldn't crash the client — report it cleanly.
    return NextResponse.json({ error: "telegram-not-configured" }, { status: 503 });
  }

  let tgUser;
  try {
    tgUser = parseTelegramUser(initData);
  } catch {
    tgUser = null;
  }
  if (!tgUser) {
    return NextResponse.json({ error: "invalid-init-data" }, { status: 401 });
  }

  const lang = normalizeLang(tgUser.languageCode);

  try {

  // Prisma client in this sandbox predates the telegram* fields; the casts below
  // are resolved by `prisma generate` on a machine with network access.
  const userModel = prisma.user as any;

  let user = await userModel.findUnique({ where: { telegramId: tgUser.id } });

  // If this Telegram id isn't linked yet, try to attach it to an existing
  // account that already lists the same @username (so members who registered by
  // email keep their profile, history and ranking instead of getting a duplicate).
  if (!user && tgUser.username) {
    const byUsername = await userModel.findFirst({
      where: {
        telegramId: null,
        telegramUsername: { equals: tgUser.username, mode: "insensitive" }
      }
    });
    if (byUsername) {
      user = await userModel.update({
        where: { id: byUsername.id },
        data: {
          telegramId: tgUser.id,
          telegramPhotoUrl: tgUser.photoUrl ?? byUsername.telegramPhotoUrl,
          photoUrl: byUsername.photoUrl ?? tgUser.photoUrl ?? null,
          preferredLang: byUsername.preferredLang ?? lang
        }
      });
    }
  }

  if (user) {
    // Keep Telegram-sourced profile data fresh on each launch.
    await userModel.update({
      where: { id: user.id },
      data: {
        telegramUsername: tgUser.username ?? user.telegramUsername,
        telegramPhotoUrl: tgUser.photoUrl ?? user.telegramPhotoUrl,
        photoUrl: user.photoUrl ?? tgUser.photoUrl ?? null
      }
    });
  } else {
    user = await userModel.create({
      data: {
        telegramId: tgUser.id,
        name: tgUser.firstName,
        lastName: tgUser.lastName,
        telegramUsername: tgUser.username,
        telegramPhotoUrl: tgUser.photoUrl,
        photoUrl: tgUser.photoUrl,
        preferredLang: lang,
        // Telegram users have no email/password; store safe placeholders so the
        // existing email/password flows keep working without collisions.
        email: `tg_${tgUser.id}@telegram.local`,
        passwordHash: await hashPassword(crypto.randomUUID()),
        level: 1.0
      }
    });
  }

  if (user.deactivatedAt) {
    return NextResponse.json({ error: "deactivated" }, { status: 403 });
  }

    setSession(user.id);

    return NextResponse.json({
      ok: true,
      needsAssessment: !user.levelAssessmentDate,
      lang: user.preferredLang ?? lang
    });
  } catch (error) {
    console.error("telegram-auth failed", error);
    return NextResponse.json({ error: "auth-failed" }, { status: 500 });
  }
}
