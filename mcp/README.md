# DataDinosaur MCP server

A [FastMCP](https://github.com/jlowin/fastmcp) Streamable-HTTP server exposing
blog/admin, semantic search, and analytics tools. Runs in the `mcp` container on
port 3333; nginx proxies it at **`https://www.datadinosaur.com/mcp`**.

## Authentication — static Bearer token (important)

Auth is a single static token, **not OAuth**. Every request must carry:

```
Authorization: Bearer <MCP_TOKEN>
```

enforced by the `BearerAuth` Starlette middleware in `server.py`. `MCP_TOKEN`
lives in the repo-root `.env` (see the main env docs). The server also
allow-lists its `Host` (`PUBLIC_HOST`, default `www.datadinosaur.com`) to avoid
FastMCP's DNS-rebinding 421 — see [[fastmcp-nginx-421]].

Downstream, the server holds its own service secrets: `X-API-Token: APP_SECRET`
for the PHP API, `X-Rag-Secret: RAG_SECRET` for the RAG service, and a Bearer
token for GoatCounter.

## How to connect

### Claude Code / Claude Desktop — supported ✅

These clients let you configure a remote MCP server with a static header, which
matches how this server authenticates. With Claude Code:

```bash
claude mcp add --transport http datadinosaur https://www.datadinosaur.com/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

or as JSON config:

```json
{
  "mcpServers": {
    "datadinosaur": {
      "type": "http",
      "url": "https://www.datadinosaur.com/mcp",
      "headers": { "Authorization": "Bearer <MCP_TOKEN>" }
    }
  }
}
```

Always use the **www** host. `my.datadinosaur.com` 301-redirects to www, and
MCP's streaming handshake does not survive a redirect.

### claude.ai web "custom connector" — NOT supported ❌

The claude.ai web connector flow expects the server to speak **OAuth** (it
discovers `/.well-known/oauth-protected-resource`, dynamically registers an
OAuth client, then runs an authorize→token flow). This server has **no OAuth** —
only the static Bearer token. So adding it in claude.ai fails with:

> Couldn't register with DataDinosaur's sign-in service … add an OAuth Client ID …

(The discovery probes return 404 at the site root and 401 under `/mcp`, so
registration can't proceed.) **This is expected. Use Claude Code / Desktop
instead.** Supporting the claude.ai web connector would require adding a full
OAuth 2.1 authorization server (metadata + dynamic client registration +
authorize/token endpoints, likely delegated to Google) — a deliberate future
project, not a config toggle.
