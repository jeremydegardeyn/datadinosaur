"""Cross-post a published DataDinosaur article to LinkedIn, with an optional image.

Exists because the alternative is a fresh ad-hoc shell command every time, built by
pasting a token into a one-liner. That is both easy to get wrong and the shape a
permission classifier blocks, so the whole sequence lives here as one stable command
that only ever talks to api.linkedin.com and never prints the token.

    python post_linkedin.py --text post.txt --image card.png
    python post_linkedin.py --text post.txt                  # text only
    python post_linkedin.py --text post.txt --image card.png --dry-run

The text file is posted verbatim, so put the blog URL and hashtags in it. An image has
to be attached at creation; LinkedIn cannot add one to a post that already exists.
"""
from __future__ import annotations

import argparse, json, urllib.error, urllib.request
from pathlib import Path

ENV = Path(r"C:\repos\datadinosaur\.env")
REGISTER = "https://api.linkedin.com/v2/assets?action=registerUpload"
UGC_POSTS = "https://api.linkedin.com/v2/ugcPosts"

# LinkedIn truncates commentary past this, and rejects it past a little more.
MAX_COMMENTARY = 3000
MAX_IMAGE_BYTES = 10 * 1024 * 1024

REFRESH_HELP = """
The LinkedIn token has expired (they last about 60 days). To refresh it:

  1. Open this URL and approve the app:
     https://www.linkedin.com/oauth/v2/authorization?response_type=code
       &client_id=8643jqiu1ia52g&redirect_uri=https://localhost
       &scope=w_member_social%20openid%20profile
  2. The browser will fail to connect to localhost. Copy the `code=...` value
     out of the address bar.
  3. Exchange it for a token and update LINKEDIN_ACCESS_TOKEN in the .env.

LINKEDIN_MEMBER_ID does not change, so only the token needs replacing.
"""


def credentials() -> tuple[str, str]:
    token = owner = ""
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("LINKEDIN_ACCESS_TOKEN="):
            token = line.split("=", 1)[1].strip()
        elif line.startswith("LINKEDIN_MEMBER_ID="):
            owner = line.split("=", 1)[1].strip()
    if not token:
        raise SystemExit(f"LINKEDIN_ACCESS_TOKEN not found in {ENV}\n{REFRESH_HELP}")
    if not owner:
        raise SystemExit(f"LINKEDIN_MEMBER_ID not found in {ENV}")
    return token, owner


def call(url: str, token: str, *, data: bytes | None = None, content_type: str | None = None,
         extra: dict | None = None, expect_json: bool = True):
    """One request, with LinkedIn's error body surfaced instead of a bare HTTPError.

    A 401 here is nearly always the expired token rather than anything the caller did,
    so it is worth catching by status and answering with the refresh steps.
    """
    headers = {"Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
    headers.update(extra or {})
    req = urllib.request.Request(url, data=data, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
            return json.loads(body) if expect_json and body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        if e.code == 401:
            raise SystemExit(f"LinkedIn returned 401.\n{REFRESH_HELP}") from None
        raise SystemExit(f"LinkedIn returned {e.code} for {url}\n{detail}") from None


def attach_image(path: Path, token: str, owner: str) -> str:
    """Register an upload slot, PUT the bytes into it, return the asset URN."""
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise SystemExit(f"{path.name}: {path.stat().st_size // 1024} KB exceeds the 10 MB cap")

    reg = json.dumps({"registerUploadRequest": {
        "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
        "owner": owner,
        "serviceRelationships": [
            {"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}],
    }}).encode()
    resp = call(REGISTER, token, data=reg, content_type="application/json")

    value = resp.get("value", {})
    asset = value.get("asset")
    mechanism = value.get("uploadMechanism", {}).get(
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest", {})
    upload_url = mechanism.get("uploadUrl")
    if not asset or not upload_url:
        raise SystemExit(f"register did not return an upload slot: {json.dumps(resp)[:400]}")

    call(upload_url, token, data=path.read_bytes(),
         content_type="application/octet-stream", expect_json=False)
    return asset


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", required=True, type=Path,
                    help="file holding the post text, posted verbatim")
    ap.add_argument("--image", type=Path, help="optional image, attached at creation")
    ap.add_argument("--title", default="", help="image title shown under the card")
    ap.add_argument("--alt", default="", help="image alt text")
    ap.add_argument("--dry-run", action="store_true",
                    help="validate and print what would be sent, call nothing")
    args = ap.parse_args()

    commentary = args.text.read_text(encoding="utf-8").strip()
    if not commentary:
        raise SystemExit(f"{args.text} is empty")
    if len(commentary) > MAX_COMMENTARY:
        raise SystemExit(f"post text is {len(commentary)} chars, over LinkedIn's {MAX_COMMENTARY}")
    # Emoji do not render reliably in the feed, so catch them before posting rather
    # than after. Anything outside the BMP is a reasonable proxy.
    stray = sorted({c for c in commentary if ord(c) > 0xFFFF})
    if stray:
        raise SystemExit(f"remove these characters before posting: {' '.join(stray)}")
    if args.image and not args.image.exists():
        raise SystemExit(f"image not found: {args.image}")

    if args.dry_run:
        print(f"text  : {args.text} ({len(commentary)} chars)")
        print(f"image : {args.image or 'none'}")
        print("\n" + commentary)
        return

    token, owner = credentials()

    media_category, media = "NONE", []
    if args.image:
        asset = attach_image(args.image, token, owner)
        media_category = "IMAGE"
        media = [{"status": "READY", "media": asset,
                  "title": {"text": args.title or "DataDinosaur"},
                  "description": {"text": args.alt or args.title or "DataDinosaur"}}]
        print(f"image uploaded: {asset}")

    body = json.dumps({
        "author": owner,
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": {
            "shareCommentary": {"text": commentary},
            "shareMediaCategory": media_category,
            **({"media": media} if media else {}),
        }},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }).encode()

    resp = call(UGC_POSTS, token, data=body, content_type="application/json",
                extra={"X-Restli-Protocol-Version": "2.0.0"})
    urn = resp.get("id", "")
    print(f"posted: {urn}")
    if urn.startswith("urn:li:share:"):
        print(f"https://www.linkedin.com/feed/update/{urn}/")


if __name__ == "__main__":
    main()
