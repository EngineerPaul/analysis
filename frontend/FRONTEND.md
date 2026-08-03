# Frontend architecture

Кратко, как устроен React-фронтенд проекта «Мои анализы».

## Стек

- React 18
- React Router 6 (`BrowserRouter` + `basename`)
- Vite

Базовый путь задаётся `VITE_ROOT_PATH` (по умолчанию `/extra/analyses`).

## Точки входа

- `index.html` — HTML-оболочка
- `src/main.jsx` — монтирует React-приложение
- `src/app.jsx` — маршруты и провайдеры (`AuthProvider`, `AnalysesProvider`)

## Страницы (`src/pages`)

- `/registration` — регистрация
- `/login` — вход
- `/` — главная таблица и тулбар
- `/graph` — график и таблица точек

## Авторизация и профиль

`src/context/AuthContext.jsx` хранит текущего пользователя (`id`, `login`, `name`, `surname`):

- заполняется из ответов login/registration
- дублируется в `localStorage`, чтобы пережить F5
- при старте сверяется с `GET /auth/me`
- очищается при logout и при окончательном 401 (после неудачного refresh)

## Общее состояние анализов

`src/context/AnalysesContext.jsx` хранит:

- **История анализов** — список всех анализов пользователя
- **Уникальные названия** — вычисляются из истории
- **Фильтры графика** — `name` / `begin` / `end` (без query-параметров)

Данные запрашиваются с backend один раз (или принудительно), а после create/delete обновляются локально без повторного GET.

## API-клиент

`src/api/client.js`:

- всегда отправляет cookie (`credentials: 'include'`)
- при `401` один раз вызывает `POST /auth/refresh` и повторяет запрос
- если сессия всё же недействительна — уведомляет подписчиков (`addUnauthorizedHandler`)
## Компоненты

- `Modal` — модальные окна
- `AnalysesForm` — создание анализа + подсказки названий
- `GraphForm` — выбор названия/периода для графика
- `DataTable` — общие таблицы
- `AnalysesChart` — SVG-график (зелёные значения, оранжевые референсы)

## Экспорт файлов

`src/utils/exportFiles.js` — одноразовая выгрузка на устройство (PDF/PNG/XLSX), без хранения на бэке:

- главная: PDF и Excel по видимой таблице
- график: PDF (шапка + график + таблица) и PNG графика с названием анализа

Зависимости: `jspdf`, `html2canvas`, `xlsx`.

## Стили

- `src/styles.css` — основные стили (зелёная палитра)
- `src/media.css` — адаптив; на узких экранах кнопки тулбара становятся иконками

## Запуск

Основной способ — Docker (см. корневой `README.md`):

```bash
docker compose up --build -d
docker compose --profile devproxy up --build -d
```

Открывать UI: `http://127.0.0.1:8000/extra/analyses/`
