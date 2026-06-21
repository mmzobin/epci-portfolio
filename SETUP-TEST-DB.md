# EPCI — безопасная настройка: прод + тестовая база

Цель: тесты и обычная разработка идут на **тестовой** базе (со своими сид‑данными),
а прод‑данные не трогаются. Прод можно открыть локально только осознанной командой,
без тестов. `/api/test/reset` физически не может стереть прод.

Ты уже создал новый проект в Supabase под тесты. Дальше — по шагам.

---

## Шаг 0. Спасти прод-данные (если ещё не сделал)

Supabase Dashboard → **прод**-проект → Database → Backups (или PITR) → восстановить
на момент до запуска тестов. Не продолжай, пока не разберёшься с этим.

---

## Шаг 1. Взять строки подключения ТЕСТОВОЙ базы

1. Открой **тестовый** проект в Supabase.
2. Вверху нажми зелёную кнопку **Connect** (или Project Settings → Database).
3. Вкладка **Connection string → URI**. Понадобятся два блока:
   - **Transaction pooler** (порт **6543**) → это `DATABASE_URL`.
   - **Session pooler** (порт **5432**) → это `DIRECT_URL`.
4. В строках замени `[YOUR-PASSWORD]` на пароль базы тестового проекта.
   (Забыл пароль → Project Settings → Database → Database password → Reset.)

То же самое позже понадобится для прод‑проекта (Шаг 4).

---

## Шаг 2. Файл `.env` — ТЕСТОВАЯ база (дефолт)

Это файл по умолчанию: на нём работают `npm run dev` и тесты. Открой `.env` в
корне и пропиши тестовые значения (прод‑строки отсюда убери):

```
# --- Тестовая база ---
DATABASE_URL="postgresql://postgres.XXX:ПАРОЛЬ@aws-0-РЕГИОН.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.XXX:ПАРОЛЬ@aws-0-РЕГИОН.pooler.supabase.com:5432/postgres"

# Разрешает тест-ресет ТОЛЬКО на этой базе. Дословно равно DATABASE_URL.
TEST_DATABASE_URL="postgresql://postgres.XXX:ПАРОЛЬ@aws-0-РЕГИОН.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
TEST_RESET_TOKEN="local-test-token"

# ВАЖНО: на тесте НЕ задавай TELEGRAM_GROUP_CHAT_ID — иначе тесты будут слать
# сообщения в реальный чат. Оставь пустым/удали эту переменную здесь.
# TELEGRAM_GROUP_CHAT_ID=

# Остальные переменные приложения (секреты, NEXT_PUBLIC_APP_URL и т.п.)
# скопируй из старого .env как есть.
```

Правила, чтобы не выстрелить себе в ногу:
- `TEST_DATABASE_URL` и `DATABASE_URL` — одинаковые строка‑в‑строку.
- `TEST_DATABASE_URL` НИКОГДА не равен прод‑строке.
- Прод не держи ни в `.env`, ни в `.env.local` (Next их грузит автоматически).

---

## Шаг 3. Создать таблицы и данные в тестовой базе

В терминале, в корне проекта:

```
npm install
npx prisma generate
npm run db:push        # создаст все таблицы в тестовой базе
npm run prisma:seed    # зальёт сид-данные (9 игроков, клубы, игры, турнир)
```

После этого в Supabase (тестовый проект → Table Editor) появятся таблицы и данные.
Сид также автоматически выполняется при каждом тест‑ресете.

---

## Шаг 4. Файл `.env.prod` — ПРОД (только для чтения вручную)

Создай отдельный файл `.env.prod` в корне. Next его сам НЕ грузит — он включается
только командой `npm run dev:prod`. Сюда — прод‑строки, и **без** `TEST_DATABASE_URL`:

```
# --- Прод база ---
DATABASE_URL="<прод transaction pooler 6543 ...?pgbouncer=true&connection_limit=1>"
DIRECT_URL="<прод session pooler 5432>"

# TEST_DATABASE_URL здесь НЕ ставим — это и защищает прод от тест-ресета.

# Прод-переменные приложения (Telegram-токен, NEXT_PUBLIC_APP_URL, секреты и т.д.)
```

Добавь `.env.prod` в `.gitignore` (если ещё нет), чтобы не закоммитить секреты.

---

## Шаг 5. Команды (уже добавлены в package.json)

```
npm run dev        # обычная работа и тесты → ТЕСТОВАЯ база (.env)
npm run test:e2e   # автотесты → ТЕСТОВАЯ база
npm run dev:prod   # запустить локально на ПРОД-данных (чтение), без тестов
```

`dev:prod` использует `dotenv-cli` (ставится через `npm install`).

---

## Шаг 6. Проверить прод на Vercel

Vercel → Settings → Environment Variables:
- `DATABASE_URL` / `DIRECT_URL` → прод-база.
- `TEST_DATABASE_URL` → **не задана**.
- `ENABLE_TEST_RESET` → не задана (или не `true`).

Быстрая проверка (должно вернуть 403):
```
curl -X POST https://epci-platform.vercel.app/api/test/reset -H "x-test-token: local-test-token"
```

---

## Как теперь это работает (итог)

- `npm run dev` / тесты → тестовая база, безопасно, со своими данными.
- `npm run dev:prod` → прод только когда осознанно нужно, тесты туда не идут.
- Тест-ресет отрабатывает лишь если `DATABASE_URL == TEST_DATABASE_URL` → значит
  только на тестовой базе. На проде и при прод‑подключении он вернёт 403.

---

## Золотые правила

- Прод-строка живёт только в `.env.prod` и в Vercel. Никогда в `.env`/`.env.local`.
- Разрушительные команды — `npm run db:reset`, `npm run db:push`, `prisma migrate`,
  тест-ресет — запускай только когда уверен, что подключена ТЕСТОВАЯ база.
- Хочешь просто посмотреть прод-данные — Supabase Dashboard (на чтение), а не
  локальное подключение.
- На тестовом `.env` не указывай `TELEGRAM_GROUP_CHAT_ID`, чтобы тесты не слали
  сообщения в реальный чат.
