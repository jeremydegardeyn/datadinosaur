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
│   ├── eval.py                 # Retrieval eval runner (Hit@k, MRR)
│   ├── eval_dataset.json       # Gold question set for eval
│   └── main.py                 # FastAPI app — /ingest, /search, /ask, /eval
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
- Inline images: in the editor, click **Insert image**, or drag-and-drop / paste an
  image into the content box. It uploads to `assets/uploads/` and inserts the
  Markdown `![alt](url)` at the cursor. Accepts JPG/PNG/GIF/WebP up to 5 MB;
  files are validated as real images and stored under generated names. Add as
  many as you like, anywhere in the post.
  - Caption: `![alt](url "My caption")` renders the image in a figure with the
    caption below it.
  - Size / align: `![alt](url){width=400}` (pixels) or `{width=60%}`; add
    `align=left|right|center`, e.g. `![alt](url "Cap"){width=400,align=center}`.
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
      ├─ 2. Hybrid retrieval → pgvector
      │       ├─ dense:  cosine similarity on embeddings (top 50)
      │       ├─ sparse: Postgres full-text / ts_rank   (top 50)
      │       └─ fuse:   Reciprocal Rank Fusion → top 4 chunks
      │
      ├─ 3. Build prompt: system instructions + retrieved chunks + question
      │
      ├─ 4. Generate answer → Gemini 2.5 Flash
      │
      └─ 5. Groundedness guard → Gemini 2.5 Flash (verify vs. context)
              │  if a claim isn't unambiguously supported, regenerate once
              ▼
         Answer + source post links returned to widget
```

### Groundedness guard

`/ask` doesn't return the first draft blind. After generation, a second Flash
call (temperature 0, JSON mode) **verifies the answer against the retrieved
context**: is every claim *explicitly and unambiguously* supported? It flags
claims that weld together separately-listed facts, attribute a system property
(where it runs, how it scales) to a subject the text doesn't tie it to, or
overstate confidence. If anything is flagged, `/ask` **regenerates once** with
those phrases forbidden, then returns.

It is **fail-open**: if the verifier errors or can't point at a specific phrase,
the original answer stands — a flaky judge must never blank a good answer. The
verdict (`{grounded, unsupported[], regenerated}`) is written to the `grounding`
column of `rag_queries`, so you can watch the catch/regenerate rate over time.
This is the same LLM-judge idea as the offline eval, run inline on every answer.

Two honest limits: it raises *faithfulness* but can't manufacture grounding
that isn't there — a fact mentioned once, ambiguously, in the source is still
the ceiling. And it adds one (sometimes two) Flash calls per answer; fine on the
free tier at this blog's volume.

### Hybrid retrieval (dense + sparse, RRF-fused)

Retrieval is **two retrievers over the same chunks**, fused — not a single
cosine search. This is the "retrieve wide, rank narrow" pattern:

| Retriever | Mechanism | Catches |
|---|---|---|
| **Dense** | Cosine similarity on Gemini embeddings | Semantic meaning, paraphrases, synonyms |
| **Sparse** | Postgres full-text search (`to_tsvector` / `ts_rank`, GIN-indexed) | Exact tokens embeddings blur — `pgvector`, `BM25`, acronyms, error codes, product names |

Each returns its own top-`CANDIDATES` (50) ranking. **Reciprocal Rank Fusion**
combines them: a chunk's fused score is `Σ 1/(RRF_K + rank)` over the lists it
appears in (`RRF_K = 60`). RRF needs only *ranks*, not comparable raw scores, so
it cleanly merges a 0–1 cosine score with an unbounded `ts_rank`. A chunk both
retrievers like floats to the top; a chunk only one finds can still surface.
Only the fused **top 4** reach the LLM — wide recall, narrow context.

It all runs in **one SQL statement** (`HYBRID_SQL` in `main.py`): two CTEs rank
the candidates, a `FULL OUTER JOIN` fuses them, and a join back to `post_chunks`
recomputes the true cosine `score` for every survivor (including sparse-only
hits). That cosine `score` — not the RRF score — still drives the `MIN_SCORE`
(0.55) relevance gate and the audit log, so out-of-scope gating is unchanged;
only the *ordering* improved. `/search` additionally returns `rrf_score` and a
`matched` flag (`semantic` / `keyword` / `both`) per result for transparency.

The sparse side is a **`GENERATED` `tsvector` column** (`content_tsv`) that
Postgres maintains automatically. Adding it backfills every existing row, so
**enabling hybrid search needs no re-ingest** — just rebuild the container.

### Components

| Component | Technology | Purpose |
|---|---|---|
| Chat widget | Vanilla JS (`chat-widget.js`) | Floating UI, sends questions, renders answers |
| PHP proxy | `src/api/rag.php` | Rate limiting (10 req/min/IP), auth, forwards to Python |
| RAG service | Python FastAPI (`rag/main.py`) | Embedding, hybrid retrieval, generation |
| Vector store | pgvector on Postgres 16 | 3072-dim embeddings (cosine) + `tsvector` full-text index, fused with RRF |
| Source of truth | MySQL `blog_posts` table | Posts read at ingest time |
| Embeddings | `gemini-embedding-001` via AI Studio | Converts text to 3072-dim vectors |
| Generation | `gemini-2.5-flash` via AI Studio | Answers from retrieved context, then a second call verifies groundedness (regenerates once if a claim isn't supported) |

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

### Upgrading an existing deploy to hybrid search

Hybrid retrieval adds a `GENERATED` `tsvector` column + GIN index, created by
`ensure_schema()` on startup. Because the column is generated, Postgres
backfills every existing chunk automatically — **no re-ingest needed**:

```bash
cd ~/datadinosaur && git pull
docker compose up -d --build rag   # restart applies the schema change on startup
```

Then check it before/after with the eval (retrieval-only, no LLM cost):

```bash
docker compose exec rag python eval.py   # Hit@1/@3/@k, MRR, out-of-scope rate
```

---

## MCP Server

An **MCP (Model Context Protocol) server** exposes the blog's own data and admin
actions as tools, so any MCP client (Claude Code, desktop, mobile) can query and
manage the site remotely.

### Tools

| Tool | What it does |
|---|---|
| `search_blog` | Hybrid search over posts (dense + keyword, RRF-fused; no LLM step) |
| `list_posts` | List posts with status / pin / visibility / views |
| `get_post` | Fetch one post's full record incl. raw Markdown (read before editing) |
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

### Deploying

The MCP server is a service in the Compose stack (`mcp/`). On the VM:

```bash
cd ~/datadinosaur
git pull
docker compose up -d --build mcp     # rebuild just the MCP container
```

`nginx` also proxies `/mcp`, so if you change the nginx config restart it too:
`docker compose up -d nginx`.

Verify it's up and the auth layer is live — an unauthenticated request should
return **401**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://my.datadinosaur.com/mcp
# → 401
```

### Connecting a client

The MCP server is hosted on the VM; you register it on whatever machine runs the
Claude **client** (your laptop, a colleague's, etc.). The dependencies live on
the server, so clients need nothing but network access + the token.

1. Install the CLI if you don't have the `claude` command:

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Add the server. Use `-s user` so it's available from every directory (the
   default is project-local). Keep it **on one line** — a `\` line-continuation
   does not work in PowerShell and silently drops the `--header`:

   ```bash
   claude mcp add -s user --transport http datadinosaur https://my.datadinosaur.com/mcp --header "Authorization: Bearer <MCP_TOKEN>"
   ```

3. Confirm and refresh:

   ```bash
   claude mcp list      # expect: datadinosaur ✓ Connected
   ```

   Then start a **fresh** `claude` session — MCP servers load at session start,
   so they won't appear mid-conversation.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `claude: command not found` | CLI not installed — `npm install -g @anthropic-ai/claude-code` (and ensure the npm global bin is on PATH). |
| Added to "local config [project: …]" | Missing `-s user` — it was added project-scoped. Re-add with `-s user`. |
| `Headers: {}` / 401 even with a token | The `--header` got dropped (usually a `\` line break in PowerShell). Re-add on one line. |
| `HTTP 421 Misdirected Request` after auth passes | MCP SDK DNS-rebinding protection rejecting the proxied `Host`. The server allow-lists `PUBLIC_HOST` / `PUBLIC_ORIGIN` (default `my.datadinosaur.com`) via `TransportSecuritySettings`; set those env vars if the domain changes. |
| `Failed to connect` | Container not running or nginx not proxying — check `docker compose logs mcp` and that `/mcp` returns 401. |

---

## Revenue Path

1. **Consulting leads** — contact form routes to `jeremy@datadinosaur.com`.
2. **Ads** — set `ads.enabled: true` in `config.yaml` and add Google AdSense code.
3. **Content velocity** — daily blog with 5 seed posts already in `database/seed.sql`.
