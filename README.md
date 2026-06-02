# Система экзаменов

Веб-приложение для проведения экзаменов: анти-чит-трекинг и воспроизведение ответов, мультигруппы, управляемый старт, пересдачи.

**Стек:** SvelteKit (Svelte 5) + TypeScript + better-sqlite3, единый Node-сервер (adapter-node). Приложение — в каталоге [`sveltekit/`](./sveltekit).

## Быстрый старт

```bash
# Docker (из корня)
docker compose up -d --build        # http://localhost:3001

# Локально
cd sveltekit && npm install && npm run dev
```

## Нюансы

- **Чистый старт.** Прод/Docker поднимается с одной учёткой администратора. Преподавателей, группы, студентов и вопросы заводят через панель после входа; банк вопросов и список класса импортируются в UI.
- **Вход админа:** `/teacher/login` (пароль из `ADMIN_PASSWORD`, по умолчанию `admin`).
- **Секреты** — в `.env` (см. [`.env.example`](./.env.example)). В production обязателен `SESSION_SECRET` (≥32 символов, `openssl rand -base64 32`), иначе сервер не стартует.
- **Безопасность:** строгий CSP с нонсами, rate-limit на вход (PIN студента и пароль преподавателя), заголовки `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy`, graceful shutdown.
- **SQLite:** в Docker — режим WAL (named volume).

## Бэкап базы

```bash
docker compose exec -T exam node scripts/backup.mjs   # в Docker
cd sveltekit && npm run backup                         # локально
```

Онлайн-копия (WAL-safe) → `data/backups/exam-<ts>.db`. Регулярность — host-cron, ретеншн — `find data/backups -mtime +N -delete`.

## Разработка

```bash
cd sveltekit
npm run check     # типы (svelte-check)
npm run lint      # prettier + eslint
npm run build     # сборка
```

Интеграционный тест: поднять сервер и `TEST_PORT=<port> node test.js`. CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)): lint + check + build + интеграционный тест.
