# DataDinosaur

> Human data expertise for the AI era — blog, consulting, and career guidance for data engineers.

**Stack:** PHP 8.2-FPM · Nginx · MySQL 8.0 · pgvector · Docker Compose · Let's Encrypt

---

## Project Structure

```
datadinosaur/
├── docker-compose.yml          # Production (with SSL)
├── docker-compose.dev.yml      # Local development
├── .env.example                # Copy to .env and fill in
├── nginx/                      # Nginx config + certbot mounts
├── php/                        # PHP-FPM Dockerfile + config
├── rag/                        # RAG service (see RAG section below)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py                 # FastAPI app — /ingest + /ask
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
        │   └── rag.php         # PHP proxy to RAG service
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

## RAG Chat Widget

The site includes a **Retrieval-Augmented Generation (RAG)** chat widget that lets visitors ask questions and get answers grounded in the blog posts.

### How it works

```
Visitor question
      │
      ▼
chat-widget.js          (floating 💬 button, vanilla JS)
      │  POST /api/rag/ask
      ▼
rag.php                 (PHP proxy — rate limiting, auth)
      │  POST http://rag:8000/ask
      ▼
main.py (FastAPI)
      │
      ├─ 1. Embed question → Gemini Embeddings API (gemini-embedding-001, 3072-dim)
      │
      ├─ 2. Cosine similarity search → pgvector (top 4 matching blog chunks)
      │
      ├─ 3. Build prompt: system instructions + retrieved chunks + question
      │
      └─ 4. Generate answer → Gemini 2.5 Flash
              │
              ▼
         Answer + source post links returned to widget
```

### Components

| Component | Technology | Purpose |
|---|---|---|
| Chat widget | Vanilla JS (`chat-widget.js`) | Floating UI, sends questions, renders answers |
| PHP proxy | `src/api/rag.php` | Rate limiting (10 req/min/IP), auth, forwards to Python |
| RAG service | Python FastAPI (`rag/main.py`) | Embedding, retrieval, generation |
| Vector store | pgvector on Postgres 16 | Stores 3072-dim embeddings, cosine similarity search |
| Source of truth | MySQL `blog_posts` table | Posts read at ingest time |
| Embeddings | `gemini-embedding-001` via AI Studio | Converts text to 3072-dim vectors |
| Generation | `gemini-2.5-flash` via AI Studio | Answers questions using retrieved context |

### Ingestion

Blog post content is chunked (~400 words with 50-word overlap), embedded, and stored in pgvector. Ingestion runs:

- **Automatically** when a post is published (hooked into `publish.php`)
- **Manually** via the **Re-index Posts** button on the admin dashboard

Re-indexing is idempotent — safe to run any time. All published posts are re-processed on each run using `ON CONFLICT DO UPDATE`.

### Cost

Designed to be **free or near-free** for a small blog:

| Resource | Cost |
|---|---|
| Gemini API (AI Studio key) | Free quota |
| pgvector (Docker on existing VM) | $0 |
| Python RAG container (same VM) | $0 |

### Environment variables

Add these to `.env` alongside the existing MySQL vars:

```env
GEMINI_API_KEY=your-key-from-aistudio.google.com
RAG_SECRET=generate-with-openssl-rand-hex-32
RAG_URL=http://rag:8000
PG_DB=rag
PG_USER=rag
PG_PASSWORD=your-pg-password
```

### First-time setup

After deploying:

```bash
# Drop any stale pgvector table (first deploy only)
docker compose exec pgvector psql -U rag -d rag -c "DROP TABLE IF EXISTS post_chunks;"

# Rebuild the RAG container
docker compose up -d --build rag

# Trigger initial index from admin dashboard → Re-index Posts
# or via curl:
curl -X POST https://my.datadinosaur.com/api/rag/ingest \
  -H "Cookie: <admin session cookie>"
```

---

## MCP Server

An **MCP (Model Context Protocol) server** exposes the blog's own data and admin
actions as tools, so any MCP client (Claude Code, desktop, mobile) can query and
manage the site remotely.

### Tools

| Tool | What it does |
|---|---|
| `search_blog` | Semantic search over posts (pgvector retrieval, no LLM step) |
| `list_posts` | List posts with status / pin / visibility / views |
| `list_comments` | List comments by status (`pending` / `approved` / `spam`) |
| `create_post` | Publish a new post (Markdown), auto-slug + RAG re-index |
| `update_post` | Partial update — send only the fields to change |
| `toggle_pin` / `toggle_visibility` | Pin/hide a post |
| `moderate_comment` | Approve / spam / delete a comment |
| `get_traffic` / `top_pages` | GoatCounter analytics over a period |

### Architecture

```
MCP client ──HTTPS, Bearer MCP_TOKEN──► nginx /mcp ──► mcp container (:3333)
                                                          │
   blog admin/CRUD ─X-API-Token (APP_SECRET)→ PHP /api/blog, /api/publish
   semantic search ─X-Rag-Secret→ rag /search (pgvector)
   analytics       ─Bearer→ GoatCounter API
```

The MCP server is a Python container (`mcp/`) speaking **Streamable HTTP**. It
reuses the existing `X-API-Token` machine-auth (same token the publish skill
uses) to reach admin endpoints without a browser session — those endpoints skip
CSRF for token calls since token auth isn't cookie-based. Client auth is a
bearer token (`MCP_TOKEN`) enforced as edge middleware in the app.

### Environment variables

```env
MCP_TOKEN=generate-with-openssl-rand-hex-32   # clients send Authorization: Bearer <this>
GOATCOUNTER_CODE=datadinosaur
GOATCOUNTER_API_TOKEN=from-goatcounter-settings-api
# APP_SECRET, RAG_SECRET, RAG_URL are shared with the rest of the stack
```

### Connecting a client

```bash
claude mcp add --transport http datadinosaur https://my.datadinosaur.com/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

---

## Revenue Path

1. **Consulting leads** — contact form routes to `jeremy@datadinosaur.com`.
2. **Ads** — set `ads.enabled: true` in `config.yaml` and add Google AdSense code.
3. **Content velocity** — daily blog with 5 seed posts already in `database/seed.sql`.
