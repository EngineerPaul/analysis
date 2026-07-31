# CI/CD (GitHub Actions)

Документ описывает полный процесс настройки непрерывной интеграции и деплоя для проекта **Мои анализы**.

Репозиторий: `https://github.com/EngineerPaul/analysis.git`  
Прод-путь на сервере: `/var/www/Diary-project/analysis`  
Ветка деплоя: `master`

Схема:

```text
push в master
  → GitHub Actions: CI (pytest, проверка compose)
  → если CI ок: SSH на сервер
  → git reset --hard origin/master
  → docker compose up --build -d
```

Profile `devproxy` на проде **не** используется.

---

## 0. Что должно быть до CI

На сервере уже:

1. Склонирован репозиторий в `/var/www/Diary-project/analysis`
2. Есть файл `.env` (из `.env.example`, с продовыми значениями) — **не в git**
3. Сеть Docker: `docker network create extra_services` (если ещё нет)
4. Сервисы хотя бы раз успешно поднимались вручную
5. Внешний nginx настроен (см. `NGINX.md`)
6. У пользователя SSH есть права на `git` и `docker compose` в каталоге проекта

Проверка вручную:

```bash
cd /var/www/Diary-project/analysis
git status
docker compose ps
```

---

## 1. Создать SSH-ключ для GitHub Actions

Отдельный ключ только для CI (не использовать личный `id_rsa`).

**На своём компьютере:**

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./github_actions_ed25519 -N ""
```

Появятся два файла:

| Файл | Куда |
|------|------|
| `github_actions_ed25519` | GitHub Secret `SSH_PRIVATE_KEY` (приватный) |
| `github_actions_ed25519.pub` | на сервер в `authorized_keys` (публичный) |

Лучше сделать локально и поместить в gitignore. Один ключ (длинный) сохранить в github (прямо на сайте), второй - в ~/.ssh/authorized_keys. В последнем файле может быть сколько угодно ключей (в разных строчках).

**На сервере** (под тем же пользователем, что будет в `SSH_USER`):

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# вставить одной строкой содержимое github_actions_ed25519.pub
chmod 600 ~/.ssh/authorized_keys
```

**Проверка с ПК:**

```bash
ssh -i ./github_actions_ed25519 -p 22 USER@HOST
# должен пустить без пароля
```

После успешной проверки приватный ключ можно удалить с ПК (он уже будет в GitHub Secrets). Публичный хранить не обязательно.

---

## 2. Секреты в GitHub

Репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret | Что писать | Как узнать |
|--------|------------|------------|
| `SSH_HOST` | хост сервера | домен или IP, выданный сервером |
| `SSH_USER` | пользователь SSH | то, что до `@` |
| `SSH_PORT` | порт SSH | обычно `22`; если `ssh -p 2222` — пишите `2222` |
| `SSH_PRIVATE_KEY` | весь приватный ключ | содержимое `github_actions_ed25519`, включая `BEGIN`/`END` |
| `DEPLOY_PATH` | путь к проекту | `/var/www/Diary-project/analysis` |

Опционально:

| Secret | Значение по умолчанию |
|--------|------------------------|
| `DEPLOY_BRANCH` | `master` |

`.env` и секреты приложения в GitHub **не** кладём — они уже на сервере.

---

## 3. Файлы CI в репозитории

После настройки секретов в репозитории добавляются (отдельным шагом разработки):

```text
.github/workflows/ci-cd.yml   # pipeline: CI + deploy
.github/deploy_ssh.sh         # команды на сервере после git pull
```

### Что делает CI (job `ci`)

На `ubuntu-latest` при push/PR в `master` и при `workflow_dispatch`:

1. Checkout кода
2. `cp .env.example .env` (в CI нет секретов; compose требует файл из `env_file`)
3. Создание сети `extra_services` (нужна compose)
4. `docker compose config`
5. `docker compose build backend`
6. `docker compose run --rm --no-deps backend pytest`

Deploy **не** запускается на pull_request.

### Что делает Deploy (job `deploy`)

Только при **push** в `master` и после успешного CI:

1. SSH на сервер (`appleboy/ssh-action`)
2. `cd $DEPLOY_PATH`
3. `git fetch` + `git reset --hard origin/master`
4. `.github/deploy_ssh.sh`:
   - проверка `.env` и `docker-compose.yml`
   - `docker network create extra_services` (если нет)
   - `docker compose up -d --build` (**без** `--profile devproxy`)
   - `docker compose ps`

---

## 4. Права Git на сервере

CI делает `git fetch` от имени `SSH_USER`.

В этом проекте (как у Diary2.0) remote — **HTTPS**, и `git fetch` на сервере уже проходит без пароля. Отдельный Deploy key **не обязателен**.

Проверка:

```bash
cd /var/www/Diary-project/analysis
git remote -v
git fetch --dry-run
```

Если вдруг fetch начнёт просить логин — настройте credential/PAT или SSH deploy key (запасной вариант).

---

## 5. Первый запуск pipeline

1. Закоммитить и запушить workflow-файлы в `master`
2. GitHub → **Actions** — дождаться зелёного CI
3. Job Deploy должен зайти по SSH и пересобрать контейнеры
4. Проверить сайт: `https://daystream.ru/extra/analysis/`

Ручной запуск: **Actions** → нужный workflow → **Run workflow** (`workflow_dispatch`), если он включён в yaml.

---

## 6. Типовые ошибки

| Симптом | Что проверить |
|---------|----------------|
| `Permission denied (publickey)` | `SSH_PRIVATE_KEY` полный; pub в `authorized_keys`; верный `SSH_USER` |
| `Connection refused` | `SSH_HOST`, `SSH_PORT`, firewall |
| `DEPLOY_PATH` not found | путь секрета совпадает с реальным каталогом |
| `git` authentication failed | deploy key / remote URL на сервере |
| `network extra_services not found` | `docker network create extra_services` |
| `.env` missing | создать на сервере из `.env.example`, не из CI |
| CI зелёный, сайт старый | смотреть логи Deploy; `docker compose ps` на сервере |

---

## 7. Чеклист «CI готов»

- [ ] Проект на сервере в `/var/www/Diary-project/analysis` работает вручную
- [ ] Есть `.env` на сервере
- [ ] Сеть `extra_services` существует
- [ ] Создан ключ `github_actions_ed25519` / `.pub`
- [ ] Pub в `~/.ssh/authorized_keys` у `SSH_USER`
- [ ] SSH с ключом с ПК проходит без пароля
- [ ] В GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`
- [ ] Git на сервере тянет `origin/master` без интерактива
- [x] Добавлены `.github/workflows/ci-cd.yml` и `.github/deploy_ssh.sh`
- [ ] Push в `master` → Actions зелёные → сайт обновился

---

## 8. Безопасность

- Не коммитить `.env`, приватные ключи, `github_actions_ed25519`
- Ключ CI — отдельный, с минимальными правами (один пользователь, один каталог по возможности)
- `git reset --hard` на проде затирает локальные незакоммиченные правки в каталоге деплоя — всё важное только в git или в `.env` вне git
- Secrets в GitHub видны только админам репозитория

---

## Связанные документы

- `README.md` — запуск dev/prod
- `NGINX.md` — внешний nginx и сеть `extra_services`
