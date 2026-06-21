/**
 * Telegram bot helpers (Bot API over HTTPS, no extra deps).
 *
 * Env:
 *  - TELEGRAM_BOT_TOKEN       (required) bot token from @BotFather
 *  - TELEGRAM_GROUP_CHAT_ID   (optional) group chat for push notifications
 *  - TELEGRAM_BOT_USERNAME    (optional) for the group "open app" deep link
 *  - TELEGRAM_WEBHOOK_SECRET  (optional) validates incoming webhook calls
 *  - NEXT_PUBLIC_APP_URL      Mini App URL (web_app button in private chats)
 */

type InlineButton = { text: string; url?: string; web_app?: { url: string } };
type InlineKeyboard = { inline_keyboard: InlineButton[][] };

/**
 * Emoji are built from code points at runtime. Astral-plane emoji written as
 * literals can get mangled into literal "\uXXXX" text by the bundler/minifier;
 * constructing them from code points keeps the source ASCII so the real emoji
 * is always produced at runtime.
 */
export const EMOJI = {
  ball: String.fromCodePoint(0x1f3be),
  pointDown: String.fromCodePoint(0x1f447),
  check: String.fromCodePoint(0x2705),
  calendar: String.fromCodePoint(0x1f4c5),
  pin: String.fromCodePoint(0x1f4cd),
  target: String.fromCodePoint(0x1f3af),
  money: String.fromCodePoint(0x1f4b0),
  people: String.fromCodePoint(0x1f465)
};

/** Escape user-provided text for Telegram HTML parse_mode. */
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function token() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

export function isBotConfigured() {
  return Boolean(token());
}

/** Map-app buttons (Google Maps / Waze / Apple) that open the address. */
function mapsButtons(address: string, city: string): InlineButton[] {
  const q = encodeURIComponent([address, city, "Israel"].filter(Boolean).join(", "));
  return [
    { text: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` },
    { text: "Waze", url: `https://waze.com/ul?q=${q}` },
    { text: "Apple Maps", url: `https://maps.apple.com/?q=${q}` }
  ];
}

async function call(method: string, payload: Record<string, unknown>) {
  const t = token();
  if (!t) return { ok: false, skipped: true };
  try {
    const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string; error_code?: number };
    if (!json.ok) {
      console.warn(`telegram ${method} not ok:`, json.error_code, json.description, "chat:", (payload as { chat_id?: unknown }).chat_id);
    }
    return json;
  } catch (error) {
    console.error(`telegram ${method} failed`, error);
    return { ok: false };
  }
}

export async function sendMessage(chatId: string | number, text: string, replyMarkup?: InlineKeyboard) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export type AppTarget = { path?: string; startParam?: string };

/** Open-app button. In private chats a web_app button launches the Mini App
 * directly at `path`; in groups Telegram only allows url buttons, so we deep-link
 * the bot with `startParam` (the Mini App reads it and navigates). */
export function openAppKeyboard(label: string, context: "private" | "group", target?: AppTarget): InlineKeyboard {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const username = process.env.TELEGRAM_BOT_USERNAME;
  const path = target?.path ?? "";

  if (context === "private" && appUrl) {
    return { inline_keyboard: [[{ text: label, web_app: { url: `${appUrl}${path}` } }]] };
  }
  const url = username ? `https://t.me/${username}?startapp=${target?.startParam ?? "open"}` : `${appUrl}${path}`;
  return { inline_keyboard: [[{ text: label, url }]] };
}

/** Send a notification to the community group chat (no-op if not configured). */
export async function notifyGroup(text: string, buttonLabel = "Открыть приложение", target?: AppTarget, extraRows?: InlineButton[][]) {
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId) return { ok: false, skipped: true };
  const keyboard = openAppKeyboard(buttonLabel, "group", target);
  if (extraRows?.length) keyboard.inline_keyboard.push(...extraRows);
  return sendMessage(groupChatId, text, keyboard);
}

/** DM the same message to each chat id (participants who started the bot).
 * Failures per recipient are swallowed so one blocked user can't break the rest. */
async function dmEach(chatIds: string[], text: string, buttonLabel: string, target?: AppTarget, extraRows?: InlineButton[][]) {
  console.log(`telegram dmEach: ${chatIds.length} recipient(s)`);
  if (!chatIds.length) return { ok: true, skipped: true };
  // Use a deep-link url button (works in any chat) rather than a web_app button,
  // which Telegram can reject in private messages if the Mini App domain isn't verified.
  const keyboard = openAppKeyboard(buttonLabel, "group", target);
  if (extraRows?.length) keyboard.inline_keyboard.push(...extraRows);
  await Promise.all(chatIds.map((id) => sendMessage(id, text, keyboard).catch(() => undefined)));
  return { ok: true };
}

function fmtDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export async function notifyNewGame(game: {
  title: string;
  startsAt: Date;
  city: string;
  club: string;
  address: string;
  minLevel: number;
  maxLevel: number;
  maxPlayers: number;
  pricePerPlayer: { toString(): string };
}) {
  const text = [
    `${EMOJI.ball} <b>Новая игра!</b>`,
    `<b>${escapeHtml(game.title)}</b>`,
    `${EMOJI.calendar} ${fmtDate(game.startsAt)}`,
    `${EMOJI.pin} ${game.city}, ${game.address}`,
    `${EMOJI.target} Уровень ${game.minLevel.toFixed(1)}–${game.maxLevel.toFixed(1)}  ·  ${EMOJI.money} ₪${game.pricePerPlayer.toString()}`,
    `${EMOJI.people} Состав 0/${game.maxPlayers}`,
    `Записывайтесь ${EMOJI.pointDown}`
  ].join("\n");
  return notifyGroup(text, "Записаться", { path: "/#games", startParam: "games" }, [mapsButtons(game.address, game.city)]);
}

/** Group scarcity nudge: posted once when a game has exactly one slot left, to
 * drive last-minute sign-ups without spamming the chat on every join. */
export async function notifyLastSpot(game: { title: string; startsAt: Date; city: string; address: string; maxPlayers: number }) {
  const fire = String.fromCodePoint(0x1f525);
  const text = [
    `${fire} <b>Осталось 1 место!</b>`,
    `<b>${escapeHtml(game.title)}</b>`,
    `${EMOJI.calendar} ${fmtDate(game.startsAt)}`,
    `${EMOJI.pin} ${game.city}, ${game.address}`,
    `${EMOJI.people} Состав ${game.maxPlayers - 1}/${game.maxPlayers} — успей записаться ${EMOJI.pointDown}`
  ].join("\n");
  return notifyGroup(text, "Записаться", { path: "/#games", startParam: "games" });
}

/** Compact group confirmation when the court is booked — a safety net so the
 * whole lineup learns the game is on even if some have no DM channel. */
export async function notifyCourtBookedGroup(game: { title: string; startsAt: Date; city: string; address: string; joined: number; maxPlayers: number }) {
  const text = [
    `${EMOJI.check} <b>Игра состоится — корт забронирован!</b>`,
    `<b>${escapeHtml(game.title)}</b>`,
    `${EMOJI.calendar} ${fmtDate(game.startsAt)}`,
    `${EMOJI.pin} ${game.city}, ${game.address}`,
    `${EMOJI.people} Состав ${game.joined}/${game.maxPlayers}`
  ].join("\n");
  return notifyGroup(text, "Открыть игру", { path: "/#games", startParam: "games" }, [mapsButtons(game.address, game.city)]);
}

/** Private message to each participant when the game fills up. */
export async function notifyGameFull(chatIds: string[], game: { title: string; startsAt: Date; city: string; address: string; maxPlayers: number }) {
  const text = [
    `${EMOJI.check} <b>Игра собралась!</b>`,
    `<b>${escapeHtml(game.title)}</b>`,
    `${EMOJI.calendar} ${fmtDate(game.startsAt)}`,
    `${EMOJI.pin} ${game.city}, ${game.address}`,
    `${EMOJI.people} Состав ${game.maxPlayers}/${game.maxPlayers}. Не забудьте забронировать корт в Lazuz.`
  ].join("\n");
  return dmEach(chatIds, text, "Открыть игру", { path: "/#games", startParam: "games" }, [mapsButtons(game.address, game.city)]);
}

/** Private message to each participant when the court is booked — the game is
 * confirmed, so this is the moment to include "how to get there" map buttons. */
export async function notifyCourtBooked(chatIds: string[], game: { title: string; startsAt: Date; city: string; address: string }) {
  const text = [
    `${EMOJI.check} <b>Корт забронирован — игра состоится!</b>`,
    `<b>${escapeHtml(game.title)}</b>`,
    `${EMOJI.calendar} ${fmtDate(game.startsAt)}`,
    `${EMOJI.pin} ${game.city}, ${game.address}`
  ].join("\n");
  return dmEach(chatIds, text, "Открыть игру", { path: "/#games", startParam: "games" }, [mapsButtons(game.address, game.city)]);
}

/** Private message to a guest's inviter when a registered member takes the
 * guest's slot (members outrank guests until the court is booked). */
export async function notifyGuestBumped(
  chatId: string,
  game: { startsAt: Date; city: string; address: string },
  guestName: string | null,
  by: { name: string; lastName: string }
) {
  const guestLabel = guestName?.trim() ? `<b>${escapeHtml(guestName)}</b>` : "Вашего гостя";
  const text = [
    `${guestLabel} подвинул участник <b>${escapeHtml(`${by.name} ${by.lastName}`.trim())}</b> — у членов клуба приоритет на место.`,
    `${EMOJI.calendar} ${fmtDate(game.startsAt)} · ${game.city}, ${game.address}`
  ].join("\n");
  return sendMessage(chatId, text, openAppKeyboard("Открыть игру", "group", { path: "/#games", startParam: "games" }));
}

/** Private message to the organizer when a player joins their game (skipped when
 * the join fills it — notifyGameFull covers that case). */
export async function notifyGameJoined(
  chatId: string,
  game: { title: string; startsAt: Date; city: string; address: string; joined: number; maxPlayers: number },
  joiner: { name: string; lastName: string }
) {
  const text = [
    `${EMOJI.check} <b>${escapeHtml(`${joiner.name} ${joiner.lastName}`.trim())}</b> записался на твою игру · ${game.joined}/${game.maxPlayers}`,
    `<b>${escapeHtml(game.title)}</b> · ${fmtDate(game.startsAt)}`,
    `${EMOJI.pin} ${game.city}, ${game.address}`
  ].join("\n");
  return sendMessage(chatId, text, openAppKeyboard("Открыть игру", "group", { path: "/#games", startParam: "games" }));
}

export function setWebhook(url: string, secret?: string) {
  return call("setWebhook", {
    url,
    ...(secret ? { secret_token: secret } : {}),
    allowed_updates: ["message"]
  });
}
