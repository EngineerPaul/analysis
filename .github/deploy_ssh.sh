#!/usr/bin/env bash
set -euo pipefail

# Runs on the server after git reset --hard (see .github/workflows/ci-cd.yml).
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/Diary-project/analysis}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"

cd "$DEPLOY_PATH"

if [[ ! -f docker-compose.yml ]]; then
  echo "docker-compose.yml not found in DEPLOY_PATH=$DEPLOY_PATH" >&2
  exit 2
fi

if [[ ! -f .env ]]; then
  echo "Missing .env in $DEPLOY_PATH (create from .env.example on the server). Aborting." >&2
  exit 3
fi

echo "==> Repo: $DEPLOY_PATH (branch: $DEPLOY_BRANCH)"
git fetch --prune origin
git reset --hard "origin/${DEPLOY_BRANCH}"

echo "==> Ensuring docker network extra_services exists"
docker network create extra_services 2>/dev/null || true

echo "==> Deploying (prod: no devproxy profile)"
docker compose up -d --build

echo "==> Status"
docker compose ps

echo "==> Done"
