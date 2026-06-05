"""
DataDinosaur RAG service
- POST /ingest   : pull published posts from MySQL, embed, store in pgvector
- POST /ask      : answer a question grounded in blog content
- GET  /health   : liveness check
"""

import os, re, textwrap
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
TOP_K           = 4     # chunks to retrieve
EMBED_MODEL     = "gemini-embedding-001"
CHAT_MODEL      = "gemini-2.0-flash"

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
            # No index needed — exact search is fast enough for a small blog
        conn.commit()


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


# ── Routes ────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str

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
                                post_title = EXCLUDED.post_title
                    """, (
                        post["id"], post["slug"], post["title"],
                        idx, chunk, str(vec),
                    ))
                    total_chunks += 1

        pg.commit()

    return {"ok": True, "posts": len(posts), "chunks": total_chunks}


@app.post("/ask")
def ask(body: AskRequest, x_rag_secret: Optional[str] = Header(None)):
    check_auth(x_rag_secret)

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if len(question) > 500:
        raise HTTPException(status_code=400, detail="question too long")

    # Embed the query
    q_vec = embed_query(question)

    # Retrieve top-k chunks via cosine similarity
    with pg_conn() as pg:
        with pg.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT post_title, post_slug, content,
                       1 - (embedding <=> %s::vector) AS score
                FROM post_chunks
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (str(q_vec), str(q_vec), TOP_K))
            rows = cur.fetchall()

    if not rows:
        return {"answer": "I don't have enough blog content indexed yet. Check back after posts are published!", "sources": []}

    # Build context block
    context_parts = []
    sources = []
    seen_slugs = set()
    for row in rows:
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

    prompt = textwrap.dedent(f"""
        You are a helpful assistant for DataDinosaur, a data engineering and consulting blog
        written by Jeremy. Answer the user's question based ONLY on the blog content provided
        below. If the answer isn't covered in the content, say so honestly — don't make things up.
        Keep answers concise and friendly. Refer to the blog posts naturally, e.g. "In my post on X..."

        BLOG CONTENT:
        {context}

        USER QUESTION:
        {question}

        ANSWER:
    """).strip()

    url = f"{GEMINI_BASE}/models/{CHAT_MODEL}:generateContent?key={GEMINI_API_KEY}"
    r   = http.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=30)
    r.raise_for_status()
    answer = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

    return {"answer": answer, "sources": sources}
