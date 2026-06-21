# Переезд Supabase из Токио (ap-northeast-1) во Франкфурт (eu-central-1)

**Зачем.** База сейчас в Токио: каждый SQL-запрос из Израиля/Европы несёт ~300–600 мс
сетевой задержки (замерено: TCP connect ~650 мс). Франкфурт даст ~50–70 мс —
ускорение всех операций с базой в 5–10 раз.

**Почему переезд, а не настройка.** Supabase не умеет менять регион существующего
проекта. Официальный путь — новый проект + перенос данных.

**Время.** Подготовка ~30 мин (без простоя) + окно простоя 10–15 мин на сам перенос.

---

## Что переносим, а что нет

| Компонент | Действие |
|---|---|
| Postgres, схема `public` (все таблицы Prisma + история миграций `_prisma_migrations`) | Дамп → восстановление |
| Storage: бакет `avatars` | Скрипт копирования файлов |
| Колонка `User.photoUrl` (абсолютные URL со старым доменом) | Один UPDATE после переноса |
| Auth-пользователи (`auth.users`) | **Не переносим** — см. ниже |
| Настройки Auth (Site URL, Redirect URLs) | Настроить заново в новом проекте |
| 4 переменные в `.env` и на хостинге | Заменить на значения нового проекта |

**Почему auth.users не переносим:** приложение хранит пароли само
(`User.passwordHash`, bcrypt) и использует Supabase Auth только для отправки
писем восстановления пароля. `ensureSupabaseAuthUser` в `lib/supabase-admin.ts`
создаёт auth-пользователя автоматически (со случайным паролем) при первом же
запросе «забыли пароль». В новом проекте они пересоздадутся сами по мере надобности.

---

## Шаг 0. Подготовка (без простоя)

1. Инструменты:

   ```bash
   brew install libpq
   brew link --force libpq   # добавляет pg_dump и psql в PATH
   pg_dump --version          # должно быть ≥ версии Postgres нового проекта (сейчас PG17)
   ```

2. В дашборде **старого** проекта ([supabase.com/dashboard](https://supabase.com/dashboard)):
   - Кнопка **Connect** (вверху) → вкладка с connection string → скопируйте
     **Session pooler** (порт **5432**, хост `...pooler.supabase.com`).
     Не берите «Direct connection» (`db.<ref>.supabase.co`) — с 2024 года он
     резолвится только в IPv6 и из обычной домашней/офисной сети чаще всего недоступен.
     И не берите Transaction pooler (порт 6543) — он не подходит для pg_dump.
   - Пароль базы. Если не помните — **Settings → Database → Reset database password**
     (сброс на минуту разорвёт активные соединения — лучше сделать заранее, не в окно простоя).
   - **Settings → API**: запишите `Project ref` (он же виден в URL дашборда),
     `service_role` ключ.

3. Зафиксируйте контрольные цифры (сравним после переноса):

   ```bash
   psql "<SESSION_POOLER_URL_СТАРОГО>" -c \
     'SELECT (SELECT count(*) FROM "User") AS users,
             (SELECT count(*) FROM "Game") AS games,
             (SELECT count(*) FROM "Participation") AS participations,
             (SELECT count(*) FROM "Tournament") AS tournaments,
             (SELECT count(*) FROM "Club") AS clubs;'
   ```

## Шаг 1. Создать новый проект во Франкфурте (без простоя)

1. Dashboard → **New project**.
2. Organization — та же. Name — например `padel-community-eu`.
3. **Region: Europe (Frankfurt) — eu-central-1**. Это главный пункт всего гайда.
4. Database password — сгенерируйте и сохраните.
5. Подождите ~2 минуты, пока проект развернётся.
6. Сразу запишите из нового проекта: `Project ref`, **Settings → API** →
   `anon` и `service_role` ключи, и обе connection string
   (**Session pooler**, порт 5432 — для переноса; **Transaction pooler**,
   порт 6543 — для `.env` приложения).

## Шаг 2. Настроить новый проект (без простоя)

Это то, что не переносится дампом — настраивается руками:

1. **Storage → New bucket**: имя `avatars`, включите **Public bucket**
   (приложение раздаёт аватары по публичным URL — `lib/avatar-storage.ts`).
2. **Authentication → URL Configuration**:
   - **Site URL** — адрес продакшена (тот, что приложение определяет как
     `NEXT_PUBLIC_APP_URL`, например `https://ваш-домен`).
   - **Redirect URLs** — добавьте `https://ваш-домен/reset-password`
     и `http://localhost:3000/reset-password` (для локальной разработки).
   Без этого письма «восстановить пароль» будут вести на нерабочие ссылки.
3. Если в старом проекте настраивали кастомный SMTP или правили шаблоны писем
   (**Authentication → Emails**) — повторите. Если не трогали, пропустите.

## Шаг 3. Дамп старой базы — начало окна простоя

С этого момента не вносите изменения в данные (выберите тихое время).

```bash
pg_dump "<SESSION_POOLER_URL_СТАРОГО>" \
  --schema=public \
  --no-owner --no-privileges \
  --clean --if-exists \
  -f padel-backup.sql
```

Пояснение флагов:
- `--schema=public` — только ваши таблицы. Служебные схемы (`auth`, `storage`,
  `realtime`...) Supabase создаёт в новом проекте сам, тащить их нельзя.
- `--no-owner --no-privileges` — без привязки к ролям старого проекта,
  иначе restore упадёт на `ALTER ... OWNER`.
- `--clean --if-exists` — дамп сам удалит одноимённые объекты перед созданием
  (позволяет безопасно перезапустить восстановление).

База маленькая — дамп займёт меньше минуты.

## Шаг 4. Восстановить в новый проект

```bash
psql "<SESSION_POOLER_URL_НОВОГО>" \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file padel-backup.sql
```

`--single-transaction` + `ON_ERROR_STOP=1` — официально рекомендуемый Supabase
режим: либо всё восстановится целиком, либо ничего (не останется половины данных).
Предупреждения вида `NOTICE: ... does not exist, skipping` — это нормальная
работа `--if-exists`, не ошибки.

Проверьте контрольные цифры и историю миграций Prisma:

```bash
psql "<SESSION_POOLER_URL_НОВОГО>" -c \
  'SELECT (SELECT count(*) FROM "User") AS users,
          (SELECT count(*) FROM "Game") AS games,
          (SELECT count(*) FROM "Participation") AS participations,
          (SELECT count(*) FROM "Tournament") AS tournaments,
          (SELECT count(*) FROM "Club") AS clubs;'
psql "<SESSION_POOLER_URL_НОВОГО>" -c 'SELECT count(*) FROM "_prisma_migrations";'
```

Числа должны совпасть с шагом 0 (миграций сейчас 4).

## Шаг 5. Перенести файлы аватаров

Скрипт копирует все файлы бакета `avatars` из старого проекта в новый
(подставьте refs и service_role ключи):

```bash
npx tsx - <<'EOF'
import { createClient } from "@supabase/supabase-js";

const OLD_URL = "https://<СТАРЫЙ_REF>.supabase.co";
const OLD_KEY = "<СТАРЫЙ service_role>";
const NEW_URL = "https://<НОВЫЙ_REF>.supabase.co";
const NEW_KEY = "<НОВЫЙ service_role>";
const BUCKET = "avatars";

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

async function listAll(prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await oldDb.storage.from(BUCKET)
      .list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...await listAll(path)); // папка
      else files.push(path);
    }
    if (!data || data.length < 1000) break;
  }
  return files;
}

const paths = await listAll();
console.log(`Найдено файлов: ${paths.length}`);
for (const path of paths) {
  const { data, error } = await oldDb.storage.from(BUCKET).download(path);
  if (error) throw new Error(`download ${path}: ${error.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  const { error: upErr } = await newDb.storage.from(BUCKET)
    .upload(path, buf, { contentType: data.type, upsert: true });
  if (upErr) throw new Error(`upload ${path}: ${upErr.message}`);
  console.log("✓", path);
}
console.log("Готово");
EOF
```

Затем почините абсолютные URL аватаров в базе (колонка `photoUrl` хранит
домен старого проекта; `avatarPath` относительный — его трогать не надо):

```bash
psql "<SESSION_POOLER_URL_НОВОГО>" -c \
  "UPDATE \"User\" SET \"photoUrl\" = replace(\"photoUrl\", '<СТАРЫЙ_REF>', '<НОВЫЙ_REF>') WHERE \"photoUrl\" LIKE '%<СТАРЫЙ_REF>%';"
```

Проверка: `SELECT "photoUrl" FROM "User" WHERE "photoUrl" IS NOT NULL LIMIT 3;` —
URL должны указывать на новый ref, и открываться в браузере.

## Шаг 6. Переключить приложение

В `.env` замените четыре значения (всё остальное не трогайте):

```env
# Connect → Session pooler (порт 5432) нового проекта.
# Не transaction pooler: с ним Prisma вынужден включать pgbouncer=true,
# что превращает каждый запрос в ~5 round-trip'ов (замерено: 315 мс против 63 мс).
DATABASE_URL="postgresql://postgres.<НОВЫЙ_REF>:<ПАРОЛЬ>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# Settings → API нового проекта
NEXT_PUBLIC_SUPABASE_URL="https://<НОВЫЙ_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<новый anon>"
SUPABASE_SERVICE_ROLE_KEY="<новый service_role>"
```

Точный хост pooler'а берите из дашборда (Connect): префикс может быть
`aws-0-eu-central-1` или `aws-1-eu-central-1` — копируйте как показано.
`lib/prisma.ts` сам допишет `connection_limit=5` к pooler-URL (а для порта 6543 —
ещё и обязательный `pgbouncer=true`), дописывать параметры руками не нужно.

Если приложение задеплоено (Vercel): **Settings → Environment Variables** —
обновите те же 4 переменные и сделайте **Redeploy**. Это конец окна простоя.

## Шаг 7. Проверка

```bash
# задержка до базы: ожидаем ~50–100 мс вместо 300–600
npx tsx -e "import {prisma} from './lib/prisma'; const t=Date.now(); await prisma.user.count(); console.log('query:', Date.now()-t, 'ms'); await prisma.\$disconnect()"

npm run typecheck
npx playwright test        # полный e2e-прогон: должен стать в разы быстрее
```

Ручной смоук-тест:
1. Главная: список игр и аватары видны.
2. Вход под своим аккаунтом (пароли работают — они в вашей таблице `User`).
3. Запись на игру / отмена.
4. **Восстановление пароля**: «Забыли пароль» → письмо пришло → ссылка ведёт на
   `/reset-password` → новый пароль работает. Этот поток затрагивает все
   перенастроенные части (Auth URL config, anon key, service role).
5. Загрузка нового аватара в профиле (проверяет Storage-запись).

## Шаг 8. Уборка (через несколько дней стабильной работы)

- Старый проект: **Settings → General → Pause project** (бесплатно, можно
  возобновить) — безопаснее, чем сразу Delete.
- Удалите `padel-backup.sql` — в нём все данные пользователей.
- Удалите файл `".env copy"` из корня (из git-индекса он уже убран).

## Откат

Старый проект продолжает работать всё время переезда. Если что-то пошло не так —
верните прежние 4 значения в `.env` (и на Vercel), и приложение мгновенно
вернётся на Токио. Поэтому паузить/удалять старый проект можно только после
нескольких дней стабильной работы на Франкфурте.

## Частые проблемы

- **`pg_dump: error: server version mismatch`** — клиент pg_dump старее сервера.
  `brew upgrade libpq` и проверьте, что в PATH версия из brew (`which pg_dump`).
- **Подключение к `db.<ref>.supabase.co` висит/падает** — это IPv6-only хост;
  используйте Session pooler URL.
- **Restore упал на `ALTER ... OWNER` или `GRANT`** — дамп снят без
  `--no-owner --no-privileges`; переснимите с флагами из шага 3.
- **Письма сброса пароля не приходят** — встроенный SMTP Supabase имеет лимит
  (~2 письма/час) и предназначен только для разработки; для продакшена настройте
  свой SMTP в Authentication → Emails (Resend, Postmark и т.п.).
- **Ссылка из письма ведёт «не туда»** — проверьте Site URL и Redirect URLs
  (шаг 2.2) и переменную `NEXT_PUBLIC_APP_URL` на хостинге.
