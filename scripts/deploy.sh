#!/bin/bash
# Deploy / update DataDinosaur on the GCP VM
# Run from the repo root on the VM

set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing PHP dependencies..."
docker compose -f docker-compose.yml exec php composer install \
  --no-dev --optimize-autoloader --no-interaction \
  --working-dir=/var/www

echo "==> Restarting containers..."
docker compose -f docker-compose.yml up -d --build --remove-orphans

echo "==> Running DB migrations (if any)..."
# docker compose -f docker-compose.yml exec db mysql -u root -p"$MYSQL_ROOT_PASSWORD" datadinosaur < database/migrations/latest.sql

echo "==> Done. Site is live at https://${DOMAIN:-my.datadinosaur.com}"
