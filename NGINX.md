# NGINX

Встраивание сервиса в `https://daystream.ru/extra/analysis/`.

## Как связаны сервисы

В `docker-compose.yml` порты backend/frontend на хост **не публикуются**.  
Контейнеры `analysis_backend` и `analysis_frontend` висят во внешней сети `extra_services`.

Внешний (prod) nginx должен быть в той же сети и ходить по **именам контейнеров**, не через `127.0.0.1`.

```bash
docker network create extra_services   # если сети ещё нет
# контейнер host-nginx тоже подключить к extra_services
```

Внутренние порты процессов:

- frontend (nginx со статикой): `9001`
- backend (uvicorn): `9002`

## Пример location для prod

```nginx
location /extra/analysis/api/ {
    proxy_pass http://analysis_backend:9002/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /extra/analysis/ {
    proxy_pass http://analysis_frontend:9001/extra/analysis/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /extra/analysis {
    return 301 /extra/analysis/;
}
```

В dev-прокси (`nginx/nginx.conf`) включено `absolute_redirect off`, чтобы `301` на trailing slash не сбрасывал порт (иначе `Host: 127.0.0.1:8000` превращался бы в `http://127.0.0.1/extra/analysis/`). В `frontend/nginx.conf` и на хостовом nginx (порт 80/443) это не нужно: редирект без слэша обрабатывает внешний nginx, а стандартный порт в URL и так не пишется.

После правок:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Dev-прокси в compose

Файл `nginx/nginx.conf` — контейнер с profile `devproxy` (не для прода).

```bash
docker compose --profile devproxy up --build -d
```

- слушает `localhost:8000`
- проксирует на `analysis_frontend:9001` и `analysis_backend:9002` по docker-сети `default` проекта

## Cookie / CORS

- Cookie path: `/extra/analysis`
- Prod: `Secure=true`, `SameSite=Lax` (или `Strict`)
- Dev: `COOKIE_SECURE=false`
- CORS origin prod: `https://daystream.ru`
