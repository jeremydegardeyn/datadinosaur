#!/bin/sh
set -e

# Run composer install on first startup (before vendor/ exists)
if [ ! -d "/var/www/vendor" ]; then
    echo "==> Installing Composer dependencies..."
    composer install --no-interaction --optimize-autoloader --working-dir=/var/www
fi

exec "$@"
