# Telegram Mini App — настройка

Этот слой превращает существующее веб-приложение EPCI в **Telegram Mini App**: вход без пароля через Telegram, кнопка брони в Lazuz, переключатель RU/EN и современный экран-приветствие.

## Что добавлено в коде

- `lib/telegram-auth.ts` — проверка подписи Telegram `initData` (HMAC) и разбор пользователя.
- `app/api/telegram/auth/route.ts` — вход: проверяет подпись, находит/создаёт игрока по `telegramId`, ставит ту же cookie-сессию `padel_session`.
- `components/telegram-provider.tsx` — загрузка Telegram WebApp SDK, `ready()/expand()`, тема, авто-вход при открытии внутри Telegram.
- `components/lazuz-button.tsx` + `lib/lazuz.ts` — кнопка «Забронировать в Lazuz» (открывает приложение Lazuz через `openLink`).
- `lib/i18n.tsx` + `components/lang-toggle.tsx` — RU/EN.
- `components/mini-app-hero.tsx` — современный мобильный экран-приветствие с логотипом.
- Prisma: в `User` добавлены `telegramId`, `telegramPhotoUrl`, `preferredLang` (миграция `20260613000000_add_user_telegram_id`).

## Переменные окружения (.env)

Добавьте к существующим:

```
TELEGRAM_BOT_TOKEN=токен_от_@BotFather
# необязательно — ссылка/диплинк брони по умолчанию (иначе откроется lazuz.co.il):
NEXT_PUBLIC_LAZUZ_URL=https://lazuz.co.il/
```

`NEXT_PUBLIC_APP_URL` должен указывать на ваш публичный HTTPS-адрес (Telegram Mini App работает только по HTTPS).

## Шаги запуска

1. Установить зависимости и пересобрать Prisma-клиент (на машине с интернетом):
   ```
   npm install
   npx prisma generate
   ```
2. Применить миграцию к базе (Supabase/Postgres):
   ```
   npx prisma migrate deploy
   ```
3. Задеплоить приложение (рекомендуется Vercel, бесплатный тариф) — получите HTTPS-URL.
4. В Telegram у @BotFather:
   - создать бота → получить `TELEGRAM_BOT_TOKEN`;
   - `/newapp` (или Bot Settings → Menu Button) → указать URL вашего приложения как Mini App;
   - теперь кнопка/меню бота открывает приложение прямо внутри Telegram.
5. Открыть Mini App из чата — игрок входит автоматически, без email/пароля.

Старый вход по email/паролю остаётся рабочим (для веба и админки).

## Что дальше (следующие фазы)

- **Бот с уведомлениями** в групповой чат: «игра собралась/развалилась», напоминание об оплате (через тот же `TELEGRAM_BOT_TOKEN`, отдельный webhook).
- **Полный перевод RU/EN** серверных страниц (сейчас переведён новый экран и переключатель; остальные страницы — на английском).
- **7-балльная шкала уровня** — текущий опрос даёт 1.0–5.0; при необходимости перенастроить `lib/level-assessment.ts`.
- **Современный UI на остальных экранах** (профиль, игра, рейтинг) в стиле нового hero.
- **Per-club диплинки Lazuz** — хранить ссылку брони у каждого клуба.
