"""
DataDinosaur RAG retrieval eval.

Runs a gold set of questions (eval_dataset.json) against the live /search
endpoint and reports retrieval quality: per-question rank of the expected
post, plus aggregate Hit@1, Hit@3, Hit@k, MRR, and mean top score. /search is
hybrid (dense + sparse, RRF-fused), so these numbers reflect the fused ranking
exactly as production serves it. Negative
cases (expect_slugs: []) check that off-topic questions do NOT surface a
strongly-relevant chunk and that /ask flags them out of scope.

Run it inside the rag container (RAG_SECRET comes from the env there):
    docker compose exec rag python eval.py
Or point it at the deployed service from elsewhere:
    RAG_URL=https://my.datadinosaur.com/internal-rag RAG_SECRET=... python eval.py

This is a measurement tool — it never writes to the index.
"""

import os, sys, json, statistics
from urllib.parse import urlparse
import requests as http

RAG_URL    = os.getenv("RAG_URL", "http://localhost:8000").rstrip("/")
RAG_SECRET = os.getenv("RAG_SECRET", "")
HERE       = os.path.dirname(os.path.abspath(__file__))
DATASET    = os.getenv("EVAL_DATASET", os.path.join(HERE, "eval_dataset.json"))


def slug_from_url(url: str) -> str:
    return urlparse(url).path.rstrip("/").rsplit("/", 1)[-1]


def search(query: str, top_k: int):
    r = http.post(
        f"{RAG_URL}/search",
        json={"query": query, "top_k": top_k},
        headers={"X-Rag-Secret": RAG_SECRET, "Content-Type": "application/json"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("results", [])


def ask(question: str):
    r = http.post(
        f"{RAG_URL}/ask",
        json={"question": question},
        headers={"X-Rag-Secret": RAG_SECRET, "Content-Type": "application/json"},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def first_rank(results, expect):
    """1-based rank of the first result whose slug is in `expect`, else None."""
    for i, res in enumerate(results, 1):
        if slug_from_url(res.get("url", "")) in expect:
            return i
    return None


def main():
    if not RAG_SECRET:
        sys.exit("RAG_SECRET is not set — export it or run inside the rag container.")

    with open(DATASET, encoding="utf-8") as f:
        cfg = json.load(f)

    top_k     = cfg.get("top_k", 5)
    min_score = cfg.get("min_score", 0.55)
    cases     = cfg["cases"]

    reciprocals, top_scores = [], []
    hit1 = hit3 = hitk = 0
    pos_total = neg_total = 0
    neg_pass = 0
    rows = []

    for c in cases:
        q       = c["question"]
        expect  = set(c.get("expect_slugs", []))
        results = search(q, top_k)
        top     = results[0]["score"] if results else 0.0
        top_scores.append(top)

        if expect:  # positive case
            pos_total += 1
            rank = first_rank(results, expect)
            reciprocals.append(1.0 / rank if rank else 0.0)
            if rank == 1:        hit1 += 1
            if rank and rank <= 3: hit3 += 1
            if rank:             hitk += 1
            verdict = f"rank {rank}" if rank else "MISS"
            ok = "OK " if rank else "  X"
        else:       # negative / out-of-scope case
            neg_total += 1
            grounded = top >= min_score
            scope = ask(q)
            scoped_out = not scope.get("sources")
            passed = (not grounded) and scoped_out
            neg_pass += int(passed)
            verdict = f"top={top:.3f} {'grounded' if grounded else 'no-strong-match'}, " \
                      f"{'out-of-scope' if scoped_out else 'ANSWERED(!)'}"
            ok = "OK " if passed else "  X"

        rows.append((ok, q[:54], verdict, f"{top:.3f}"))

    print(f"\nRAG retrieval eval  —  {RAG_URL}  —  top_k={top_k}, min_score={min_score}\n")
    print(f"{'':3} {'question':54}  {'result':30}  top")
    print("-" * 96)
    for ok, q, verdict, top in rows:
        print(f"{ok} {q:54}  {verdict:30}  {top}")

    print("\nSummary")
    if pos_total:
        print(f"  positives: {pos_total}   "
              f"Hit@1 {hit1}/{pos_total} ({hit1/pos_total:.0%})   "
              f"Hit@3 {hit3}/{pos_total} ({hit3/pos_total:.0%})   "
              f"Hit@{top_k} {hitk}/{pos_total} ({hitk/pos_total:.0%})   "
              f"MRR {statistics.mean(reciprocals):.3f}")
    if neg_total:
        print(f"  negatives: {neg_total}   correctly out-of-scope {neg_pass}/{neg_total} "
              f"({neg_pass/neg_total:.0%})")
    print(f"  mean top score: {statistics.mean(top_scores):.3f}\n")

    failures = (pos_total - hitk) + (neg_total - neg_pass)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
