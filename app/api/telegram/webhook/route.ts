import { NextResponse } from "next/server";
import { EMOJI, openAppKeyboard, sendMessage } from "@/lib/telegram-bot";
import { joinedCount, listGames } from "@/lib/games";
import { getFullRanking } from "@/lib/ranking";

export const dynamic = "force-dynamic";

type TgChat = { id: number; type: string };
type TgUpdate = {
  message?: { text?: string; chat: TgChat; from?: { first_name?: string } };
};

function fmtDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function gamesText(): Promise<string> {
  const games = await listGames();
  if (!games.length) return "Открытых игр пока нет. Загляни позже или создай свою в приложении.";
  const lines = games.slice(0, 8).map((game) => {
    const slots = `${joinedCount(game)}/${game.maxPlayers}`;
    return `${EMOJI.ball} <b>${fmtDate(game.startsAt)}</b> · ${game.city}, ${game.club} — ${slots}, ур. ${game.minLevel.toFixed(1)}–${game.maxLevel.toFixed(1)}`;
  });
  return `<b>Ближайшие игры</b>\n${lines.join("\n")}`;
}

async function rankingText(): Promise<string> {
  const { ranked } = await getFullRanking();
  if (!ranked.length) return "Рейтинг появится после первого завершённого турнира.";
  const lines = ranked.slice(0, 5).map((player) => `${player.place}. ${player.name} ${player.lastName} — ${player.totalPoints} очк.`);
  return `<b>Топ рейтинга EPCI</b>\n${lines.join("\n")}`;
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const isPrivate = message.chat.type === "private";
  const command = text.split(/\s|@/)[0].toLowerCase();

  try {
    switch (command) {
      case "/start": {
        const name = message.from?.first_name ? `, ${message.from.first_name}` : "";
        await sendMessage(
          chatId,
          `Привет${name}! Это <b>EPCI</b> — падел‑сообщество. В приложении можно записываться на игры, видеть состав, свой уровень и рейтинг.`,
          openAppKeyboard("Открыть EPCI", isPrivate ? "private" : "group")
        );
        break;
      }
      case "/help":
        await sendMessage(
          chatId,
          ["<b>Команды</b>", "/games — ближайшие игры", "/ranking — топ рейтинга", "/start — открыть приложение", "/chatid — ID чата (для настройки уведомлений)"].join("\n")
        );
        break;
      case "/games":
        await sendMessage(chatId, await gamesText(), openAppKeyboard("Записаться в приложении", isPrivate ? "private" : "group", { path: "/#games", startParam: "games" }));
        break;
      case "/ranking":
        await sendMessage(chatId, await rankingText(), openAppKeyboard("Открыть рейтинг", isPrivate ? "private" : "group", { path: "/ranking", startParam: "ranking" }));
        break;
      case "/chatid":
        await sendMessage(
          chatId,
          `ID этого чата: <code>${chatId}</code>\nВставьте его в переменную <b>TELEGRAM_GROUP_CHAT_ID</b> в Vercel, чтобы сюда приходили уведомления.`
        );
        break;
      default:
        if (isPrivate) {
          await sendMessage(chatId, "Не знаю такую команду. Наберите /help.");
        }
    }
  } catch (error) {
    console.error("webhook handler failed", error);
  }

  return NextResponse.json({ ok: true });
}
