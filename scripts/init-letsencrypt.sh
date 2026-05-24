#!/bin/bash
# Initialise Let's Encrypt certificates for my.datadinosaur.com
# Run ONCE before first docker-compose up.
# Based on https://github.com/wmnnd/nginx-certbot

set -e

DOMAIN=${DOMAIN:-my.datadinosaur.com}
EMAIL=${CERTBOT_EMAIL:-jeremy@datadinosaur.com}
DATA_PATH="./nginx/certbot"

mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
mkdir -p "$DATA_PATH/www"

# Download recommended TLS settings
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
  echo "### Downloading recommended TLS parameters ..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > "$DATA_PATH/conf/options-ssl-nginx.conf"
  openssl dhparam -out "$DATA_PATH/conf/ssl-dhparams.pem" 2048 2>/dev/null
fi

# Start nginx with a temporary HTTP-only config
echo "### Starting nginx with temporary HTTP config ..."
docker compose -f docker-compose.yml run --rm --entrypoint "nginx -g 'daemon off;'" nginx &
NGINX_PID=$!
sleep 3

# Obtain certificate
echo "### Requesting certificate for $DOMAIN ..."
docker compose -f docker-compose.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  --agree-tos \
  --no-eff-email \
  --force-renewal

kill $NGINX_PID 2>/dev/null || true

echo ""
echo "Done! Certificates saved to $DATA_PATH/conf/live/$DOMAIN"
echo "You can now run: docker compose up -d"
