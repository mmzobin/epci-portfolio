import crypto from "crypto";

/**
 * Telegram Mini App auth.
 *
 * Validates the `initData` string that Telegram passes to a Mini App
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
 * and extracts the authenticated Telegram user.
 *
 * Requires the bot token in env: TELEGRAM_BOT_TOKEN.
 */

export type TelegramUser = {
  id: string;
  firstName: string;
  lastName: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
};

const MAX_AUTH_AGE_SECONDS = 60 * 60 * 24; // reject initData older than 24h

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

/**
 * Verify the HMAC signature of a Telegram initData string.
 * Returns the parsed params if valid, otherwise null.
 */
export function verifyInitData(initData: string): URLSearchParams | null {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  // Build the data-check-string: every field except `hash`, sorted, joined by \n.
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(getBotToken()).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // Constant-time comparison.
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Reject stale payloads to limit replay.
  const authDate = Number(params.get("auth_date"));
  if (authDate && Number.isFinite(authDate)) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > MAX_AUTH_AGE_SECONDS) return null;
  }

  return params;
}

/**
 * Validate initData and return the Telegram user, or null if invalid.
 */
export function parseTelegramUser(initData: string): TelegramUser | null {
  const params = verifyInitData(initData);
  if (!params) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    const u = JSON.parse(userRaw) as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
    };
    if (!u.id) return null;

    return {
      id: String(u.id),
      firstName: u.first_name?.trim() || u.username || "Player",
      lastName: u.last_name?.trim() || "",
      username: u.username,
      photoUrl: u.photo_url,
      languageCode: u.language_code
    };
  } catch {
    return null;
  }
}

/** Map a Telegram language code to a supported UI language. */
export function normalizeLang(languageCode?: string): "ru" | "en" {
  return languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
}
