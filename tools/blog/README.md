# Blog tooling

The `blog-post` skill and the scripts it calls. `SKILL.md` here is the same file Claude Code
loads from `~/.claude/skills/blog-post/SKILL.md`: the two paths are a **hard link**, one set of
bytes with two names, so editing either edits both and the repo copy is the backup.

Two things follow from that. A symlink would have been the obvious choice but needs
Administrator on Windows, whereas a hard link does not. And because some editors save by writing
a new file and renaming over the old one, which breaks the link silently, it is worth checking
occasionally:

```
fsutil hardlink list C:
epos\datadinosaur	oolslog\SKILL.md
```

Two paths listed means the link holds. One means they have diverged, and the fix is to copy the
newer file over the other and recreate the link with
`New-Item -ItemType HardLink -Path <skill path> -Target <repo path>`.

| File | Job |
|---|---|
| `SKILL.md` | The skill itself: voice, post format, publish and cross-post steps |
| `cdp.py` | Drive real Chrome over the DevTools Protocol and write PNG files to disk |
| `upload_images.py` | POST images to `/api/upload` and print the Markdown to paste into a post |
| `composite_card.py` | Join two screenshots into one social card: cause left, effect right |

## Why cdp.py exists

An assistant's browser tools return screenshots into the conversation, where there is no file
on disk, so they cannot be uploaded to the site or attached to a LinkedIn post. This is about
150 lines including a hand-rolled WebSocket client, so it needs neither Playwright nor Selenium,
neither of which is installed here.

```python
import cdp
cdp.launch(headless=True)             # non-headless whenever a human must sign in
t = cdp.Tab(); t.size(1600, 1000)     # deviceScaleFactor 2, so text stays crisp
t.goto("https://console.cloud.google.com/logs/router?project=...", wait=24)
print(t.shot("images/log-router.png"))
print(t.shot("images/panel.png", clip=t.box("#panel"), pad=10))
```

It uses its own Chrome profile at `.chrome-profile`, isolated from the everyday browser, which
is what makes it safe to drive and also why it starts with no sessions. For anything behind a
login, launch with `headless=False` and let the person sign in themselves; passkey and 2FA
challenges are theirs to complete and a fresh profile will trigger them.

## Gotchas that cost time

- `Tab(reuse=True)` attaches to whichever tab happens to be first. Do navigate-then-screenshot
  inside one process holding one `Tab`, or you will save the wrong page under the right name.
- Console UIs render slowly. Use `wait=20` or more, and confirm with
  `t.js("document.body.innerText")` before trusting a capture.
- Expand collapsed JSON and filter long tables before shooting, otherwise the screenshot shows
  the shape of the evidence rather than the evidence.
- Set `PYTHONIOENCODING=utf-8` on Windows when printing page text, or one stray glyph raises
  `UnicodeEncodeError` after the navigation and before the capture.
- Chrome 111 and later require PUT on `/json/new`; a GET returns 405.
- Verify published pages and images with PowerShell's `Invoke-WebRequest -Method Head`. Git Bash
  curl fails with `curl: (43)` when `-o /dev/null` meets `-w`, which looks exactly like every
  URL being unreachable when the site is fine.
