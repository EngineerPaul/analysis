# NGINX

Настройки для встраивания сервиса в `https://daystream.ru/extra/analysis/`.

## Порты сервисов на хосте

- frontend: `127.0.0.1:9001`
- backend: `127.0.0.1:9002`

Nginx (вне этого репозитория) должен проксировать **через сеть хоста** на раскрытые порты контейнеров.

## Пример location для prod

```nginx
location /extra/analysis/api/ {
    proxy_pass http://127.0.0.1:9002/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /extra/analysis/ {
    proxy_pass http://127.0.0.1:9001/extra/analysis/;
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

## Dev-прокси в compose

Файл `nginx/nginx.conf` используется контейнером профиля `devproxy`.

Запуск:

```bash
docker compose --profile devproxy up --build -d
```

Слушает `localhost:8000` и проксирует на `host.docker.internal:9001/9002`.

## Cookie / CORS

- Cookie path: `/extra/analysis`
- Prod: `Secure=true`, `SameSite=Lax` (или `Strict`)
- Dev: `COOKIE_SECURE=false`
- CORS origin prod: `https://daystream.ru`
