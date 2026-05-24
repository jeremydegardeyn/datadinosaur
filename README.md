# DataDinosaur

> Human data expertise for the AI era — blog, consulting, and career guidance for data engineers.

**Stack:** PHP 8.2-FPM · Nginx · MySQL 8.0 · Docker Compose · Let's Encrypt

---

## Project Structure

```
datadinosaur/
├── docker-compose.yml          # Production (with SSL)
├── docker-compose.dev.yml      # Local development
├── .env.example                # Copy to .env and fill in
├── nginx/                      # Nginx config + certbot mounts
├── php/                        # PHP-FPM Dockerfile + config
├── database/
│   ├── schema.sql              # Table definitions (auto-loaded)
│   └── seed.sql                # Seed blog posts (auto-loaded)
├── scripts/
│   ├── hash-password.php       # Generate admin bcrypt hash
│   ├── init-letsencrypt.sh     # One-time cert bootstrap
│   └── deploy.sh               # Pull + restart on VM
└── webroot/
    ├── composer.json
    ├── config.yaml             # Site settings (blog, ads, nav)
    ├── html/                   # Nginx document root (public)
    │   ├── index.php           # Front controller
    │   └── assets/             # CSS, JS, images
    └── src/                    # PHP source (not web-accessible)
        ├── app/                # Page controllers
        ├── api/                # JSON/redirect API endpoints
        ├── layout/             # header.php / footer.php
        └── functions/          # DB, auth, blog, mail, security
```

---

## Quick Start (Local Dev)

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/datadinosaur.git
cd datadinosaur

# 2. Copy env
cp .env.example .env
# Edit .env with your values

# 3. Generate admin password hash
php scripts/hash-password.php
# Paste ADMIN_PASSWORD_HASH into .env

# 4. Install PHP dependencies (first time)
cd webroot && composer install && cd ..

# 5. Start dev stack (port 8080, phpMyAdmin at 8081)
docker compose -f docker-compose.dev.yml up -d

# 6. Visit http://localhost:8080
```

---

## Production Deploy (GCP VM)

### First time

```bash
# On the VM — install Docker & Docker Compose, then:
git clone https://github.com/YOUR_USERNAME/datadinosaur.git
cd datadinosaur
cp .env.example .env   # fill in ALL values
php scripts/hash-password.php  # set admin hash

# Get SSL certificate (needs port 80 open, DNS pointed at VM)
bash scripts/init-letsencrypt.sh

# Start production stack
docker compose up -d --build

# Install composer deps inside container
docker compose exec php composer install --no-dev --optimize-autoloader --working-dir=/var/www
```

### Update

```bash
bash scripts/deploy.sh
```

---

## Configuration

All site settings are in [`webroot/config.yaml`](webroot/config.yaml).

| Key | Purpose |
|-----|---------|
| `blog.posts_per_page` | Listings per page |
| `blog.comments_enabled` | Enable/disable comments |
| `blog.comment_moderation` | Require approval before publishing |
| `blog.show_*` | Toggle metadata fields on post cards |
| `blog.sidebar_widgets` | Which widgets appear (`search`, `categories`, `recent_posts`) |
| `ads.enabled` | Flip to `true` and add AdSense codes to enable ads |
| `contact.consulting_types` | Dropdown options on contact form |
| `nav` | Top navigation links |

---

## Admin

- Login: navigate to any admin page (e.g., `/admin`) and you'll be prompted.
- Write posts in Markdown (with live preview tab).
- Moderate comments from the dashboard.
- View consulting inquiries from the dashboard.

---

## Security Notes

- Passwords are bcrypt-hashed (cost 12) — never stored in plaintext.
- All DB queries use PDO prepared statements.
- All output uses `htmlspecialchars`.
- CSRF tokens on all state-changing forms.
- Honeypot on the contact form.
- Nginx rate-limits: 5 login attempts/min, 3 contact submissions/min.
- Sensitive files (`.env`, `config.yaml`, `src/`, `vendor/`) are blocked at Nginx.
- HTTPS-only in production with HSTS.
- `session.cookie_secure`, `httponly`, and `samesite=Strict` set in php.ini.

---

## Revenue Path

1. **Consulting leads** — contact form routes to `jeremy@datadinosaur.com`.
2. **Ads** — set `ads.enabled: true` in `config.yaml` and add Google AdSense code.
3. **Content velocity** — daily blog with 5 seed posts already in `database/seed.sql`.
