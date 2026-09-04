"""Upload local images to DataDinosaur and print the Markdown to paste into a post.

The publish API takes Markdown, so an image has to be a URL on the site before the post
can reference it. Run this first, then use the printed lines in the post body.

    python upload_images.py chart.png screenshot.png
    python upload_images.py images/*.png --alt-from-filename
"""
from __future__ import annotations

import argparse, json, re, sys, urllib.request, uuid
from pathlib import Path

ENV = Path(r"C:\repos\datadinosaur\.env")
ENDPOINT = "https://www.datadinosaur.com/api/upload"
MAX_BYTES = 5 * 1024 * 1024


def api_token() -> str:
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("APP_SECRET="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"APP_SECRET not found in {ENV}")


def upload(path: Path, token: str) -> str:
    """POST one image as multipart/form-data. Returns the site-relative URL."""
    if path.stat().st_size > MAX_BYTES:
        raise SystemExit(f"{path.name}: {path.stat().st_size // 1024} KB exceeds the 5 MB cap")
    boundary = uuid.uuid4().hex
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode(),
        b"Content-Type: application/octet-stream\r\n\r\n",
        path.read_bytes(),
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "X-Api-Token": token,
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        payload = json.loads(r.read())
    if not payload.get("ok"):
        raise SystemExit(f"{path.name}: {payload}")
    return payload["url"]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("images", nargs="+", type=Path)
    ap.add_argument("--alt-from-filename", action="store_true",
                    help="derive alt text from the filename instead of leaving a TODO")
    args = ap.parse_args()

    token = api_token()
    print("\nPaste into the post body:\n")
    for p in args.images:
        if not p.exists():
            print(f"  missing: {p}", file=sys.stderr)
            continue
        url = upload(p, token)
        alt = (re.sub(r"[-_]+", " ", p.stem).strip().capitalize()
               if args.alt_from_filename else "TODO alt text")
        print(f"![{alt}]({url})")
    print("\nAlt text is what a reader gets when the image does not load, so write a real one.")


if __name__ == "__main__":
    main()
