# Мои анализы

Веб-сервис для хранения результатов анализов и построения графиков динамики показателей.

## Состав

- `backend/` — FastAPI + SQLAlchemy + SQLite
- `frontend/` — React + Vite + React Router
- `nginx/` — reverse-proxy для локальной проверки UI (compose profile `devproxy`)
- `NGINX.md` — настройки nginx для prod (`daystream.ru/extra/analysis`)

## Быстрый старт (Docker)

1. Скопируйте `.env.example` в `.env` и при необходимости измените секреты.
2. Запуск сервисов:

```bash
docker compose up --build -d
```

Открытые порты:

- frontend: `http://127.0.0.1:9001/extra/analysis/`
- backend: `http://127.0.0.1:9002/api/v1/` (docs: `/docs`)

SQLite-файл: `./backend/data/analysis.db` (bind mount в контейнер `/data/analysis.db`, в git не попадает).

3. Локальный nginx-прокси (как на проде, через порты хоста):

```bash
docker compose --profile devproxy up --build -d
```

UI через прокси: `http://127.0.0.1:8000/extra/analysis/`

## Переменные окружения

См. `.env.example`.

Важные:

- `ROOT_PATH=/extra/analysis` — префикс приложения (и для backend, и для сборки frontend через compose `build.args`)
- `COOKIE_PATH=/extra/analysis`
- `COOKIE_SECURE=false` для dev, `true` для prod
- `CORS_ORIGINS` — разрешённые origin фронта
- `SECRET_KEY` — секрет подписи JWT

Конфиг один: корневой `.env`. Его же Compose читает для подстановки `${ROOT_PATH}` при сборке frontend.
`env_file` у backend передаёт переменные в **запущенный** контейнер API.
У frontend отдельный `.env` не нужен: Vite-переменные нужны только на `npm run build`, их передаёт `build.args`.

## API (кратко)

Префикс: `/api/v1`

Auth:

- `POST /auth/registration`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`

Analyses:

- `POST /analysis`
- `GET /analysis`
- `DELETE /analysis/{id}`

JWT access/refresh хранятся в HttpOnly cookie (`SameSite=Lax`).

## Тесты backend (через Docker)

Нужен запущенный Docker Desktop.

```bash
docker compose build backend
docker compose run --rm backend pytest
```

Требование покрытия: не ниже 90%.

## Замечания

- Frontend и backend работают в разных контейнерах одной docker-сети.
- Отдельный контейнер БД не используется: SQLite в `./backend/data` (каталог в `.gitignore`).
- Nginx в prod внешний и проксирует на `127.0.0.1:9001` / `127.0.0.1:9002`.
- Единицы измерения в текущей версии не хранятся (см. ТЗ, будущие доработки).
- Подробности frontend: `frontend/FRONTEND.md`.
- Подробности nginx: `NGINX.md`.
