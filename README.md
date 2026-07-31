# Мои анализы

Веб-сервис для хранения результатов анализов и построения графиков динамики показателей.

## Состав

- `backend/` — FastAPI + SQLAlchemy + SQLite (`analyses_backend`)
- `frontend/` — React + Vite, статика через nginx (`analyses_frontend`)
- `nginx/` — только local reverse-proxy (compose profile `devproxy`)
- `NGINX.md` — настройки внешнего nginx для prod (`daystream.ru/extra/analyses`)
- `CI.md` — настройка GitHub Actions (секреты, SSH, деплой)

## Сеть Docker

Сервисы подключаются к внешней сети `extra_services` (чтобы host-nginx на проде ходил к ним по имени контейнера).

```bash
docker network create extra_services   # один раз, если сети ещё нет
```

Порты `80`/`8000` на хост **не публикуются**.

## Dev (локально)

1. Скопируйте `.env.example` → `.env`.
2. Запуск с прокси на `:8000`:

```bash
docker compose --profile devproxy up --build -d
```

UI: http://127.0.0.1:8000/extra/analyses/

Dev-nginx проксирует по docker-сети на `analyses_frontend:80` и `analyses_backend:8000`.

SQLite: `./backend/data/analyses.db` (в git не попадает).

## Prod

```bash
git clone https://github.com/EngineerPaul/analysis.git
cd analysis
cp .env.example .env
# SECRET_KEY, COOKIE_SECURE=true, CORS_ORIGINS=https://daystream.ru

docker network create extra_services   # если ещё нет
docker compose up --build -d           # без profile devproxy
```

Внешний nginx на сервере должен быть в сети `extra_services` и проксировать на контейнеры — см. `NGINX.md`.

Сайт: https://daystream.ru/extra/analyses/

## Переменные окружения

См. `.env.example`. Один файл — корневой `.env`.

- `ROOT_PATH` — префикс приложения (backend + `build.args` frontend)
- `COOKIE_PATH`, `COOKIE_SECURE`, `COOKIE_SAMESITE`
- `CORS_ORIGINS`
- `SECRET_KEY`
- `DATABASE_URL=sqlite:////data/analyses.db`

`env_file` у backend — переменные в **запущенный** API-контейнер.  
У frontend отдельный `.env` не нужен: `VITE_*` задаётся при сборке через compose `build.args`.

## API (кратко)

Префикс внутри backend: `/api/v1`  
Снаружи (через nginx): `/extra/analyses/api/v1/...`

- `POST /auth/registration`, `/auth/login`, `/auth/logout`, `/auth/refresh`
- `POST|GET /analyses`, `DELETE /analyses/{id}`

JWT в HttpOnly cookie (`SameSite=Lax`).

## Тесты backend

```bash
docker compose build backend
docker compose run --rm backend pytest
```

Покрытие: ориентир около 70% (`pytest --cov-fail-under=70`).

## Замечания

- Отдельный контейнер БД не используется (SQLite + bind mount `./backend/data`).
- Profile `devproxy` на прод не поднимать.
- Единицы измерения пока не хранятся.
- Frontend: `frontend/FRONTEND.md`. Nginx: `NGINX.md`.
