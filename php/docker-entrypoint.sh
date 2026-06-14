#!/bin/sh
set -e

# Run composer install on first startup (before vendor/ exists)
if [ ! -d "/var/www/vendor" ]; then
    echo "==> Installing Composer dependencies..."
    composer install --no-interaction --optimize-autoloader --working-dir=/var/www
fi

# Ensure the blog image upload dir exists and is writable by php-fpm (www-data)
mkdir -p /var/www/html/assets/uploads
chown -R www-data:www-data /var/www/html/assets/uploads || true

exec "$@"
