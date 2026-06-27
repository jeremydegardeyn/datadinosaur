"""
DataDinosaur RAG service
- POST /ingest   : pull published posts from MySQL, embed, store in pgvector
- POST /ask      : answer a question grounded in blog content
- GET  /health   : liveness check
"""

import os, re, time, json, statistics, textwrap
from typing import Optional

import pymysql
import psycopg2
import psycopg2.extras
import requests as http
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY  = os.environ["GEMINI_API_KEY"]
RAG_SECRET      = os.environ["RAG_SECRET"]          # shared secret PHP → Python

MYSQL_HOST      = os.getenv("MYSQL_HOST", "db")
MYSQL_PORT      = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_DB        = os.environ["MYSQL_DATABASE"]
MYSQL_USER      = os.environ["MYSQL_USER"]
MYSQL_PASSWORD  = os.environ["MYSQL_PASSWORD"]

PG_HOST         = os.getenv("PG_HOST", "pgvector")
PG_PORT         = int(os.getenv("PG_PORT", 5432))
PG_DB           = os.getenv("PG_DB", "rag")
PG_USER         = os.getenv("PG_USER", "rag")
PG_PASSWORD     = os.environ["PG_PASSWORD"]

CHUNK_SIZE      = 400   # words per chunk
CHUNK_OVERLAP   = 50
TOP_K           = 4     # chunks to send to the LLM after fusion
MIN_SCORE       = 0.55  # minimum cosine similarity to consider a chunk relevant
CANDIDATES      = 50    # how many to pull from EACH retriever (dense + sparse) before fusing
RRF_K           = 60    # reciprocal-rank-fusion constant; larger = flatter weighting of rank
EMBED_MODEL     = "gemini-embedding-001"
CHAT_MODEL      = "gemini-2.5-flash"

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

app = FastAPI(title="DataDinosaur RAG")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://my.datadinosaur.com"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


# ── DB helpers ────────────────────────────────────────────────────────────────

def mysql_conn():
    return pymysql.connect(
        host=MYSQL_HOST, port=MYSQL_PORT,
        db=MYSQL_DB, user=MYSQL_USER, password=MYSQL_PASSWORD,
        charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
    )

def pg_conn():
    return psycopg2.connect(
        host=PG_HOST, port=PG_PORT,
        dbname=PG_DB, user=PG_USER, password=PG_PASSWORD,
    )

def ensure_schema():
    with pg_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS post_chunks (
                    id         BIGSERIAL PRIMARY KEY,
                    post_id    INT NOT NULL,
                    post_slug  TEXT NOT NULL,
                    post_title TEXT NOT NULL,
                    chunk_idx  INT NOT NULL,
                    content    TEXT NOT NULL,
                    embedding  vector(3072),
                    UNIQUE (post_id, chunk_idx)
                );
            """)
            # Sparse (keyword/BM25-style) half of hybrid search. A GENERATED column
            # means Postgres maintains the tsvector itself — adding it backfills every
            # existing row, so no re-ingest is required to turn hybrid search on.
            cur.execute("""
                ALTER TABLE post_chunks
                ADD COLUMN IF NOT EXISTS content_tsv tsvector
                GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS post_chunks_tsv_idx
                ON post_chunks USING GIN (content_tsv);
            """)
            # No vector index needed — exact search is fast enough for a small blog
            cur.execute("""
                CREATE TABLE IF NOT EXISTS rag_queries (
                    id          BIGSERIAL PRIMARY KEY,
                    created_at  TIMESTAMPTZ DEFAULT now(),
                    endpoint    TEXT NOT NULL,
                    query       TEXT NOT NULL,
                    num_results INT  NOT NULL DEFAULT 0,
                    top_score   REAL,
                    outcome     TEXT,
                    sources     JSONB,
                    latency_ms  INT
                );
            """)
            # Inline groundedness-guard verdict for /ask: {grounded, unsupported[], regenerated}
            cur.execute("ALTER TABLE rag_queries ADD COLUMN IF NOT EXISTS grounding JSONB;")
            cur.execute("CREATE INDEX IF NOT EXISTS rag_queries_created_idx ON rag_queries (created_at DESC);")
        conn.commit()


def record_audit(endpoint, query, retrieved, outcome, latency_ms, grounding=None):
    """Append one retrieval to the rag_queries audit log. `retrieved` is a list
    of (slug, score) for what the vector search returned — logged regardless of
    whether it cleared the relevance threshold, so we can see what was matched.
    `grounding` (when set) is the inline groundedness-guard verdict for /ask.
    Best-effort: a logging failure must never break a user's query."""
    try:
        sources = psycopg2.extras.Json([
            {"slug": s, "score": round(float(sc), 4)} for s, sc in retrieved
        ])
        top = round(float(retrieved[0][1]), 4) if retrieved else None
        grounding_json = psycopg2.extras.Json(grounding) if grounding is not None else None
        with pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO rag_queries
                        (endpoint, query, num_results, top_score, outcome, sources, latency_ms, grounding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (endpoint, query[:500], len(retrieved), top, outcome, sources, latency_ms, grounding_json))
            conn.commit()
    except Exception as e:
        print(f"[audit] failed to log {endpoint} query: {e}", flush=True)


# ── Chunking ──────────────────────────────────────────────────────────────────

def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if chunk:
            chunks.append(chunk)
        i += size - overlap
    return chunks


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed(texts: list[str]) -> list[list[float]]:
    url = f"{GEMINI_BASE}/models/{EMBED_MODEL}:batchEmbedContents?key={GEMINI_API_KEY}"
    payload = {"requests": [
        {"model": f"models/{EMBED_MODEL}", "content": {"parts": [{"text": t}]}, "taskType": "RETRIEVAL_DOCUMENT"}
        for t in texts
    ]}
    r = http.post(url, json=payload, timeout=30)
    r.raise_for_status()
    return [e["values"] for e in r.json()["embeddings"]]

def embed_query(text: str) -> list[float]:
    url = f"{GEMINI_BASE}/models/{EMBED_MODEL}:embedContent?key={GEMINI_API_KEY}"
    payload = {"content": {"parts": [{"text": text}]}, "taskType": "RETRIEVAL_QUERY"}
    r = http.post(url, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()["embedding"]["values"]


# ── Retrieval (hybrid: dense + sparse, fused with RRF) ──────────────────────────
#
# Two retrievers run independently over the SAME chunks:
#   dense  — cosine similarity on Gemini embeddings (semantic meaning)
#   sparse — Postgres full-text search / ts_rank (exact terms: pgvector, BM25,
#            error codes, product names — the things embeddings blur together)
#
# Each returns its own top-`CANDIDATES` ranking. We fuse them with Reciprocal
# Rank Fusion: a chunk's fused score is the sum of 1/(RRF_K + rank) across the
# lists it appears in. RRF needs only ranks (not comparable raw scores), so it
# cleanly combines a 0–1 cosine score with an unbounded ts_rank. A chunk that
# both retrievers like floats to the top; a chunk only one retriever finds can
# still surface. Final order is by RRF; the `score` column stays plain cosine
# similarity so the MIN_SCORE relevance gate and the audit log are unchanged.
HYBRID_SQL = """
WITH q AS (
    SELECT %(qvec)s::vector AS qvec,
           websearch_to_tsquery('english', %(qtext)s) AS tsq
),
dense AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY embedding <=> (SELECT qvec FROM q)) AS rnk
    FROM post_chunks
    ORDER BY embedding <=> (SELECT qvec FROM q)
    LIMIT %(cand)s
),
sparse AS (
    SELECT id,
           ROW_NUMBER() OVER (
               ORDER BY ts_rank(content_tsv, (SELECT tsq FROM q)) DESC
           ) AS rnk
    FROM post_chunks
    WHERE content_tsv @@ (SELECT tsq FROM q)
    ORDER BY ts_rank(content_tsv, (SELECT tsq FROM q)) DESC
    LIMIT %(cand)s
),
fused AS (
    SELECT COALESCE(d.id, s.id) AS id,
           COALESCE(1.0 / (%(rrf_k)s + d.rnk), 0.0)
         + COALESCE(1.0 / (%(rrf_k)s + s.rnk), 0.0) AS rrf_score,
           d.rnk AS dense_rank,
           s.rnk AS sparse_rank
    FROM dense d
    FULL OUTER JOIN sparse s ON d.id = s.id
)
SELECT pc.post_title, pc.post_slug, pc.chunk_idx, pc.content,
       1 - (pc.embedding <=> (SELECT qvec FROM q)) AS score,
       f.rrf_score, f.dense_rank, f.sparse_rank
FROM fused f
JOIN post_chunks pc ON pc.id = f.id
ORDER BY f.rrf_score DESC
LIMIT %(final)s
"""


def hybrid_retrieve(pg, q_vec, query_text, limit_final, candidates=CANDIDATES):
    """Run dense + sparse retrieval and return the RRF-fused top `limit_final`
    rows. Each row carries the true cosine `score` (recomputed for sparse-only
    hits via the join back to post_chunks), the `rrf_score`, and the component
    `dense_rank` / `sparse_rank` (NULL if that retriever didn't surface it)."""
    with pg.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(HYBRID_SQL, {
            "qvec":  str(q_vec),
            "qtext": query_text,
            "cand":  candidates,
            "rrf_k": RRF_K,
            "final": limit_final,
        })
        return cur.fetchall()


def match_kind(row) -> str:
    """Which retriever(s) surfaced this row — for transparency in /search."""
    if row["dense_rank"] and row["sparse_rank"]:
        return "both"
    return "semantic" if row["dense_rank"] else "keyword"


# ── Generation + groundedness guard ─────────────────────────────────────────────

def gemini_generate(prompt: str, json_mode: bool = False) -> str:
    """One Gemini chat completion. json_mode asks for a JSON response (used by the
    verifier). Returns the raw text of the first candidate."""
    cfg = {"temperature": 0}
    if json_mode:
        cfg["responseMimeType"] = "application/json"
    url = f"{GEMINI_BASE}/models/{CHAT_MODEL}:generateContent?key={GEMINI_API_KEY}"
    r = http.post(url, json={"contents": [{"parts": [{"text": prompt}]}],
                             "generationConfig": cfg}, timeout=30)
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


def build_ask_prompt(context: str, question: str, forbidden: Optional[list[str]] = None) -> str:
    """The grounded-answer prompt. When `forbidden` is set (a corrective retry after
    the groundedness guard flagged claims), the model is told to omit them."""
    forbidden_block = ""
    if forbidden:
        bullets = "\n".join(f"        - {f}" for f in forbidden)
        forbidden_block = (
            "\n        A previous draft made claims the blog content does NOT support. "
            "Rewrite the answer and OMIT these entirely — do not restate or rephrase them:\n"
            f"{bullets}\n"
        )
    return textwrap.dedent(f"""
        You are a helpful assistant for DataDinosaur, a data engineering and consulting blog
        written by Jeremy. Your ONLY job is to answer questions using the blog content below.

        STRICT RULES:
        - If the question can be answered from the blog content, answer it concisely in 2-4 sentences.
        - If the question cannot be answered from the blog content — even partially — respond with exactly: OUT_OF_SCOPE
        - Never use your own training knowledge. Never guess. Never blend in outside information.
        - Answer only what the content directly states about the specific subject of the question.
          Do NOT attach properties of the surrounding system — where it runs, how it scales, what
          other components exist — to that subject unless the text explicitly says they belong to it.
          When a sentence lists several things together, do not assume a trailing detail describes
          the one you were asked about.
        - Don't pad the answer with related-but-unasked details just because they appear nearby.
        - Use plain text only — no markdown, no asterisks, no bullet points.
        - Refer to posts naturally, e.g. "In my post on X..."
{forbidden_block}
        BLOG CONTENT:
        {context}

        USER QUESTION:
        {question}

        ANSWER:
    """).strip()


def verify_grounding(answer: str, context: str) -> tuple[bool, list[str]]:
    """Strict groundedness check: is every claim in `answer` EXPLICITLY and
    UNAMBIGUOUSLY supported by `context`? Returns (grounded, unsupported_phrases).
    Fail-open: any error or unparseable verdict returns (True, []) so a flaky
    judge never blanks a good answer."""
    rubric = textwrap.dedent(f"""
        You are a strict fact-checker for a blog Q&A system. You are given CONTEXT
        (excerpts from blog posts) and an ANSWER generated from it.

        Flag any statement in the ANSWER that is not EXPLICITLY and UNAMBIGUOUSLY
        supported by the CONTEXT. Treat as UNSUPPORTED:
        - a claim that welds together two facts the context lists separately;
        - a claim that attributes a property (where something runs, how it scales,
          what it connects to) to a subject the context does not directly tie it to;
        - anything stated more specifically or more confidently than the context warrants.

        Judge ONLY support by the CONTEXT — not whether the claim is true in general.

        Return ONLY minified JSON:
        {{"grounded": true|false, "unsupported": ["<verbatim phrase from the answer>", ...]}}
        If everything is supported, return {{"grounded": true, "unsupported": []}}.

        CONTEXT:
        {context}

        ANSWER:
        {answer}
    """).strip()
    try:
        verdict = json.loads(gemini_generate(rubric, json_mode=True))
        grounded = bool(verdict.get("grounded", True))
        unsupported = [str(u) for u in verdict.get("unsupported", []) if str(u).strip()]
        # Trust the explicit boolean; an empty list with grounded=false means
        # "uneasy but couldn't point at a phrase" — nothing to correct, so fail open.
        return grounded, unsupported
    except Exception as e:
        print(f"[verify] grounding check failed, failing open: {e}", flush=True)
        return True, []


# ── Routes ────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str

class SearchRequest(BaseModel):
    query: str
    top_k: int = TOP_K

def check_auth(x_rag_secret: Optional[str]):
    if x_rag_secret != RAG_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.on_event("startup")
def startup():
    ensure_schema()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ingest")
def ingest(x_rag_secret: Optional[str] = Header(None)):
    check_auth(x_rag_secret)

    # Fetch all published posts from MySQL
    with mysql_conn() as mysql:
        with mysql.cursor() as cur:
            cur.execute("""
                SELECT id, slug, title, content
                FROM blog_posts
                WHERE status = 'published' AND visible = 1
            """)
            posts = cur.fetchall()

    if not posts:
        return {"ok": True, "posts": 0, "chunks": 0}

    total_chunks = 0

    with pg_conn() as pg:
        with pg.cursor() as cur:
            for post in posts:
                text   = html_to_text(post["content"])
                chunks = chunk_text(text)

                if not chunks:
                    continue

                # Embed all chunks for this post in one batch
                embeddings = embed(chunks)
                if isinstance(embeddings[0], float):
                    embeddings = [embeddings]  # single chunk edge case

                for idx, (chunk, vec) in enumerate(zip(chunks, embeddings)):
                    cur.execute("""
                        INSERT INTO post_chunks (post_id, post_slug, post_title, chunk_idx, content, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (post_id, chunk_idx) DO UPDATE
                            SET content   = EXCLUDED.content,
                                embedding = EXCLUDED.embedding,
                                post_title = EXCLUDED.post_title,
                                post_slug  = EXCLUDED.post_slug
                    """, (
                        post["id"], post["slug"], post["title"],
                        idx, chunk, str(vec),
                    ))
                    total_chunks += 1

        pg.commit()

    return {"ok": True, "posts": len(posts), "chunks": total_chunks}


@app.post("/search")
def search(body: SearchRequest, x_rag_secret: Optional[str] = Header(None)):
    """Raw retrieval: return the top-k matching blog chunks with no LLM
    generation step. Lets an agent (the MCP server) reason over the source
    material itself, and avoids a Gemini generate call on every query."""
    check_auth(x_rag_secret)

    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    if len(query) > 500:
        raise HTTPException(status_code=400, detail="query too long")

    k = max(1, min(20, body.top_k))
    started = time.monotonic()
    q_vec = embed_query(query)

    with pg_conn() as pg:
        rows = hybrid_retrieve(pg, q_vec, query, k)

    results = [{
        "title":     r["post_title"],
        "url":       f"https://my.datadinosaur.com/blog/{r['post_slug']}",
        "chunk":     r["content"],
        "score":     round(float(r["score"]), 4),       # cosine similarity
        "rrf_score": round(float(r["rrf_score"]), 5),   # fused rank score (ordering)
        "matched":   match_kind(r),                     # semantic | keyword | both
    } for r in rows]

    record_audit("search", query,
                 [(r["post_slug"], r["score"]) for r in rows],
                 "ok" if rows else "no_results",
                 int((time.monotonic() - started) * 1000))

    return {"query": query, "results": results}


@app.post("/ask")
def ask(body: AskRequest, x_rag_secret: Optional[str] = Header(None)):
    check_auth(x_rag_secret)

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if len(question) > 500:
        raise HTTPException(status_code=400, detail="question too long")

    started = time.monotonic()

    # Embed the query
    q_vec = embed_query(question)

    # Retrieve top-k chunks via hybrid search (dense + sparse, RRF-fused)
    with pg_conn() as pg:
        rows = hybrid_retrieve(pg, q_vec, question, TOP_K)

    retrieved = [(r["post_slug"], r["score"]) for r in rows]
    def audit(outcome, grounding=None):
        record_audit("ask", question, retrieved, outcome,
                     int((time.monotonic() - started) * 1000), grounding)

    if not rows:
        audit("no_chunks")
        return {"answer": "I don't have enough blog content indexed yet. Check back after posts are published!", "sources": []}

    # Filter out chunks below the relevance threshold
    relevant_rows = [r for r in rows if r["score"] >= MIN_SCORE]
    if not relevant_rows:
        audit("below_threshold")
        return {"answer": "That topic isn't covered in my blog posts. Try asking about data engineering, career advice, or consulting!", "sources": []}

    # Build context block — only from relevant chunks
    context_parts = []
    sources = []
    seen_slugs = set()
    for row in relevant_rows:
        context_parts.append(
            f"[From: \"{row['post_title']}\"]\n{row['content']}"
        )
        if row["post_slug"] not in seen_slugs:
            sources.append({
                "title": row["post_title"],
                "url":   f"https://my.datadinosaur.com/blog/{row['post_slug']}",
            })
            seen_slugs.add(row["post_slug"])

    context = "\n\n---\n\n".join(context_parts)

    answer = gemini_generate(build_ask_prompt(context, question))

    # If the LLM flagged the question as out of scope, suppress sources and return friendly message
    if answer.strip().upper().startswith("OUT_OF_SCOPE"):
        audit("out_of_scope")
        return {"answer": "That topic isn't covered in my blog posts. Try asking about data engineering, career advice, or consulting!", "sources": []}

    # Groundedness guard: verify the answer against the retrieved context before
    # returning. If a claim isn't unambiguously supported, regenerate once with it
    # forbidden. Fail-open — if the check errors or can't point at a phrase, the
    # original answer stands (a flaky judge must never blank a good answer).
    grounded, unsupported = verify_grounding(answer, context)
    regenerated = False
    if not grounded and unsupported:
        retry = gemini_generate(build_ask_prompt(context, question, forbidden=unsupported))
        if retry and not retry.strip().upper().startswith("OUT_OF_SCOPE"):
            answer = retry
            regenerated = True

    audit("answered", grounding={
        "grounded": grounded, "unsupported": unsupported, "regenerated": regenerated,
    })
    return {"answer": answer, "sources": sources}


EVAL_DATASET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eval_dataset.json")


@app.post("/eval")
def run_eval(x_rag_secret: Optional[str] = Header(None)):
    """Run the gold eval dataset (eval_dataset.json) against retrieval and
    return metrics for the admin dashboard. Retrieval only — no answer
    generation — so it's fast and cheap. Positive cases want the expected post
    ranked high (Hit@1/@3/@k, MRR); negative cases pass when no chunk clears the
    relevance threshold (i.e. retrieval didn't falsely ground an off-topic ask)."""
    check_auth(x_rag_secret)

    try:
        with open(EVAL_DATASET, encoding="utf-8") as f:
            cfg = json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="eval_dataset.json not found")

    top_k     = int(cfg.get("top_k", 5))
    min_score = float(cfg.get("min_score", MIN_SCORE))
    cases     = cfg.get("cases", [])

    out_cases, recips, top_scores = [], [], []
    pos = neg = hit1 = hit3 = hitk = neg_pass = 0

    with pg_conn() as pg:
        for c in cases:
            q      = c["question"]
            expect = set(c.get("expect_slugs", []))
            q_vec  = embed_query(q)
            rows   = hybrid_retrieve(pg, q_vec, q, top_k)

            slugs = [r["post_slug"] for r in rows]
            top   = float(rows[0]["score"]) if rows else 0.0
            top_scores.append(top)

            rank = next((i for i, s in enumerate(slugs, 1) if s in expect), None)

            if expect:
                pos += 1
                recips.append(1.0 / rank if rank else 0.0)
                if rank == 1:          hit1 += 1
                if rank and rank <= 3: hit3 += 1
                if rank:               hitk += 1
                passed, ctype = rank is not None, "positive"
            else:
                neg += 1
                passed, ctype = top < min_score, "negative"
                neg_pass += int(passed)

            out_cases.append({
                "question":  q,
                "type":      ctype,
                "expect":    sorted(expect),
                "top_slug":  slugs[0] if slugs else None,
                "top_score": round(top, 4),
                "rank":      rank,
                "pass":      passed,
                "note":      c.get("note", ""),
            })

    summary = {
        "top_k": top_k, "min_score": min_score,
        "positives": pos, "negatives": neg,
        "hit1_pct": round(hit1 / pos, 3) if pos else None,
        "hit3_pct": round(hit3 / pos, 3) if pos else None,
        "hitk_pct": round(hitk / pos, 3) if pos else None,
        "mrr":      round(statistics.mean(recips), 3) if recips else None,
        "neg_pct":  round(neg_pass / neg, 3) if neg else None,
        "mean_top": round(statistics.mean(top_scores), 3) if top_scores else None,
    }
    return {"ok": True, "summary": summary, "cases": out_cases}
