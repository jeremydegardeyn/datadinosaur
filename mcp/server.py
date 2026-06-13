"""
DataDinosaur MCP server
=======================
Exposes the blog's own data and admin actions as MCP tools over Streamable
HTTP, so any MCP client (Claude Code, desktop, mobile) can query and manage
the site remotely.

Tools
  search_blog        retrieve relevant blog chunks (pgvector, no LLM step)
  list_posts         list posts with status / pin / visibility
  list_comments      list comments by status (for moderation)
  create_post        publish a new post
  update_post        partial-update an existing post
  toggle_pin         pin / unpin a post
  toggle_visibility  show / hide a post
  moderate_comment   approve / spam / delete a comment
  get_traffic        GoatCounter pageview totals over a period
  top_pages          GoatCounter most-visited paths over a period

How it talks to the rest of the stack (all over the docker network):
  - blog/admin actions  -> PHP API, authenticated with X-API-Token = APP_SECRET
  - new posts           -> PHP /api/publish (same token)
  - semantic search     -> RAG service /search, X-Rag-Secret = RAG_SECRET
  - analytics           -> GoatCounter API, Bearer token

Auth: clients must send `Authorization: Bearer <MCP_TOKEN>`. The check runs as
edge middleware here; nginx just proxies /mcp through.
"""

import os
from datetime import date, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────────
MCP_TOKEN   = os.environ["MCP_TOKEN"]                       # clients authenticate with this
APP_SECRET  = os.environ["APP_SECRET"]                      # X-API-Token for the PHP API
RAG_SECRET  = os.environ["RAG_SECRET"]                      # X-Rag-Secret for the RAG service
RAG_URL     = os.getenv("RAG_URL", "http://rag:8000")
SITE_URL    = os.getenv("SITE_URL", "https://my.datadinosaur.com").rstrip("/")
PORT        = int(os.getenv("MCP_PORT", "3333"))

GOATCOUNTER_CODE      = os.getenv("GOATCOUNTER_CODE", "")
GOATCOUNTER_API_TOKEN = os.getenv("GOATCOUNTER_API_TOKEN", "")
GOATCOUNTER_BASE      = f"https://{GOATCOUNTER_CODE}.goatcounter.com" if GOATCOUNTER_CODE else ""

API_HEADERS = {"X-API-Token": APP_SECRET}
RAG_HEADERS = {"X-Rag-Secret": RAG_SECRET, "Content-Type": "application/json"}

mcp = FastMCP("datadinosaur", stateless_http=True)


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _api_get(params: dict) -> dict:
    with httpx.Client(timeout=30) as c:
        r = c.get(f"{SITE_URL}/api/blog", params=params, headers=API_HEADERS)
        r.raise_for_status()
        return r.json()

def _api_post(data: dict) -> dict:
    """POST form-encoded to /api/blog (matches the PHP $_POST handlers)."""
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{SITE_URL}/api/blog", data=data, headers=API_HEADERS)
        r.raise_for_status()
        return r.json()


# ── Content tools ─────────────────────────────────────────────────────────────

@mcp.tool()
def search_blog(query: str, top_k: int = 4) -> dict:
    """Semantic search over published blog posts. Returns the most relevant
    content chunks (with source post title, URL, and similarity score) so you
    can answer questions grounded in what Jeremy has actually written."""
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{RAG_URL}/search", json={"query": query, "top_k": top_k}, headers=RAG_HEADERS)
        r.raise_for_status()
        return r.json()

@mcp.tool()
def list_posts(limit: int = 20, offset: int = 0) -> dict:
    """List blog posts (newest first) with id, title, slug, status, pin and
    visibility flags, publish date, and view count. Includes the total count
    for pagination."""
    return _api_get({"action": "admin_list", "limit": limit, "offset": offset})

@mcp.tool()
def list_comments(status: str = "pending") -> dict:
    """List blog comments by status — one of 'pending', 'approved', or 'spam'.
    Use this to find comment ids before calling moderate_comment."""
    return _api_get({"action": "admin_comments", "status": status})

@mcp.tool()
def create_post(title: str, content: str, excerpt: str = "",
                category: str = "", status: str = "published") -> dict:
    """Publish a new blog post. content is Markdown. status is 'published' or
    'draft'. The slug is generated automatically and a RAG re-index is
    triggered on publish. Returns the new post id, slug, and URL."""
    payload = {"title": title, "content": content, "excerpt": excerpt,
               "category": category, "status": status}
    with httpx.Client(timeout=60) as c:
        r = c.post(f"{SITE_URL}/api/publish", json=payload, headers=API_HEADERS)
        r.raise_for_status()
        return r.json()

@mcp.tool()
def update_post(post_id: int, title: Optional[str] = None, slug: Optional[str] = None,
                excerpt: Optional[str] = None, content: Optional[str] = None,
                status: Optional[str] = None, pinned: Optional[bool] = None,
                visible: Optional[bool] = None) -> dict:
    """Partially update a post — send only the fields you want to change.
    status is 'published' or 'draft'. Flipping to 'published' the first time
    stamps the publish date. Returns the post id, slug, and URL."""
    data: dict = {"action": "update", "post_id": post_id}
    if title   is not None: data["title"]   = title
    if slug    is not None: data["slug"]    = slug
    if excerpt is not None: data["excerpt"] = excerpt
    if content is not None: data["content"] = content
    if status  is not None: data["status"]  = status
    if pinned  is not None: data["pinned"]  = int(pinned)
    if visible is not None: data["visible"] = int(visible)
    return _api_post(data)

@mcp.tool()
def toggle_pin(post_id: int, pinned: bool) -> dict:
    """Pin (True) or unpin (False) a post. Pinned posts sort to the top of
    listings."""
    return _api_post({"action": "toggle_pin", "post_id": post_id, "pinned": int(pinned)})

@mcp.tool()
def toggle_visibility(post_id: int, visible: bool) -> dict:
    """Show (True) or hide (False) a post on the public site without deleting
    it."""
    return _api_post({"action": "toggle_visibility", "post_id": post_id, "visible": int(visible)})

@mcp.tool()
def moderate_comment(comment_id: int, action: str) -> dict:
    """Moderate a comment. action is 'approve', 'spam', or 'delete'."""
    if action not in ("approve", "spam", "delete"):
        return {"error": "action must be approve, spam, or delete"}
    return _api_post({"action": "moderate_comment", "comment_id": comment_id, "moderation": action})


# ── Analytics tools (GoatCounter) ──────────────────────────────────────────────

def _gc_get(path: str, params: dict) -> dict:
    if not (GOATCOUNTER_BASE and GOATCOUNTER_API_TOKEN):
        return {"error": "GoatCounter is not configured (set GOATCOUNTER_CODE and GOATCOUNTER_API_TOKEN)."}
    headers = {"Authorization": f"Bearer {GOATCOUNTER_API_TOKEN}"}
    with httpx.Client(timeout=30) as c:
        r = c.get(f"{GOATCOUNTER_BASE}{path}", params=params, headers=headers)
        r.raise_for_status()
        return r.json()

@mcp.tool()
def get_traffic(days: int = 7) -> dict:
    """Total pageviews and unique visitors over the last N days, from
    GoatCounter."""
    start = (date.today() - timedelta(days=days)).isoformat()
    end   = date.today().isoformat()
    data  = _gc_get("/api/v0/stats/total", {"start": start, "end": end})
    if "error" in data:
        return data
    return {"start": start, "end": end,
            "pageviews": data.get("total"), "unique_visitors": data.get("total_unique")}

@mcp.tool()
def top_pages(days: int = 7, limit: int = 10) -> dict:
    """Most-visited paths over the last N days, from GoatCounter."""
    start = (date.today() - timedelta(days=days)).isoformat()
    end   = date.today().isoformat()
    data  = _gc_get("/api/v0/stats/hits", {"start": start, "end": end, "limit": limit})
    if "error" in data:
        return data
    pages = [{"path": h.get("path"), "title": h.get("event") or h.get("path"),
              "pageviews": h.get("count")} for h in data.get("hits", [])][:limit]
    return {"start": start, "end": end, "pages": pages}


# ── Edge auth + app wiring ──────────────────────────────────────────────────────

class BearerAuth(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.headers.get("authorization", "") != f"Bearer {MCP_TOKEN}":
            return JSONResponse({"error": "unauthorized"}, status_code=401)
        return await call_next(request)

# Use the FastMCP app directly so its Streamable HTTP session lifespan is
# preserved; auth is layered on as middleware.
app = mcp.streamable_http_app()
app.add_middleware(BearerAuth)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
