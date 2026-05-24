FROM php:8.2-fpm

WORKDIR /var/www

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    zlib1g-dev libzip-dev unzip \
    libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
    libicu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo pdo_mysql mysqli \
        gd zip intl \
    && rm -rf /var/lib/apt/lists/*

# PHP config
COPY php.ini /usr/local/etc/php/conf.d/custom.ini

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install PHP deps (composer.json must exist in webroot)
COPY --chown=www-data:www-data . /var/www/build-tmp
RUN cp /var/www/build-tmp/composer.json /var/www/composer.json 2>/dev/null || true
RUN if [ -f /var/www/composer.json ]; then composer install --no-dev --optimize-autoloader --no-interaction --working-dir=/var/www; fi

RUN chown -R www-data:www-data /var/www

CMD ["php-fpm"]
