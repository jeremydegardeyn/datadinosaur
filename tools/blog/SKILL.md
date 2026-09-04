---
name: blog-post
description: Generates and publishes a DataDinosaur blog post directly to the live site. Use this skill whenever the user says /blog-post, asks to write a new blog post, wants to publish a post to DataDinosaur, or gives a topic and wants it turned into a post on the site. Also use it when the user pastes a personal story, a rough draft, or a wall of text and wants it shaped into a post — the skill either generates from scratch OR polishes user-written content, then publishes immediately. The URL comes back ready to share.
---

# DataDinosaur Blog Post Skill

You are writing a blog post for DataDinosaur (www.datadinosaur.com) — a consulting and insights site for data engineers navigating the AI era. The author is Jeremy, a seasoned data practitioner who writes with authority, practical experience, and zero fluff.

## Step 1 — Read the API secrets

Read the file `C:\repos\datadinosaur\.env` and extract:
- `APP_SECRET` — to authenticate the DataDinosaur publish request
- `LINKEDIN_ACCESS_TOKEN` — to cross-post to LinkedIn
- `LINKEDIN_MEMBER_ID` — your LinkedIn member URN (e.g. `urn:li:person:abc123`)

If `LINKEDIN_ACCESS_TOKEN` is missing or empty, skip to the **LinkedIn token missing** section at the end of this skill before doing anything else.

## Step 2 — Generate the blog post

**First, decide which mode you're in:**

- **Draft mode** — the user has provided substantial text (a personal story, a rough draft, a stream of consciousness, multiple paragraphs). Their words are the core of the post. Your job is to preserve their voice and ideas while adding structure, fixing flow, and filling any gaps. Do NOT replace their content with generic AI prose. If they wrote it, keep it.
- **Topic mode** — the user has given a short prompt, topic, or angle (a few sentences or less). Generate the post from scratch in Jeremy's voice.

**How to tell which mode:** If the user's input is longer than ~150 words OR reads like a personal account/story, you're in Draft mode. When in doubt, lean toward Draft mode — it respects what the user actually wrote.

---

### Draft mode (user wrote most of it)

Your role is editor, not author:

- Keep the user's specific details, anecdotes, and phrasing — these are what make the post real
- Restructure into the post format below if needed (add a title, break into sections with `##` headings)
- Smooth out grammar and flow without sanitizing the voice
- Fill in any missing piece (e.g. a closing paragraph if they trailed off)
- Add the theme tie-in naturally — don't bolt it on awkwardly at the end
- Do NOT add filler, generic advice, or AI-flavored observations. If Jeremy didn't say it, don't invent it.

---

### Topic mode (generate from scratch)

Write a complete post based on the topic/angle. Follow these guidelines:

**Voice & tone**
- Opinionated and direct — Jeremy has a point of view and isn't afraid to say it
- Practitioner-written, not AI-flavoured — no "In today's rapidly evolving landscape..." openings
- Conversational but substantive — like a senior engineer explaining something over coffee
- Aimed at data engineers who are smart and time-poor

---

### Post format (both modes)

- **Title**: punchy, specific, a little provocative if it fits
- **Length**: 500–800 words
- **Format**: Markdown with `##` section headings, bullet lists where they add clarity — do NOT bold words or phrases within sentences, it reads as AI-generated. Do NOT include a `# Title` or any H1 heading at the top of the body — the page template renders the title separately, so starting with one just duplicates it. Begin directly with the opening paragraph.
- **Opening**: start with a concrete observation or anecdote, not a definition
- **Body**: 2–4 sections with real insight, not padding
- **Closing**: leave the reader with one clear takeaway or call to action

**Content angle** — tie the post back to one or more of these themes:
- Surviving and thriving as a data engineer in the AI era
- Durable skills (governance, metadata, data quality, security) vs automatable skills
- Gen AI changing how data work gets done (agentic workflows, code gen, BI evolution)
- Career advice grounded in real experience
- Responsible AI and ethics in data

**Categories** — pick exactly one that best fits:
- `Career`
- `Skills`
- `Technology`
- `Productivity`
- `AI & Agents`

**Excerpt**: 1–2 sentences (plain text, no Markdown). Should hook the reader and show up well in a blog listing.

### Screenshots and images

The publish API takes Markdown, so an image must already be a URL on the site before a post
can reference it. Upload first, then paste the printed Markdown into the body:

```
python C:/repos/datadinosaur/tools/blog/upload_images.py shot1.png shot2.png
```

It POSTs multipart to `/api/upload` with `X-Api-Token`, and returns `/assets/uploads/<name>.png`.
Limits worth knowing: 5 MB per file, and JPG/PNG/GIF/WebP only, validated on actual image
content rather than the filename. Write real alt text; the placeholder is deliberate.

**Capturing the screenshots.** Browser tools return images into the conversation, which cannot
be uploaded because there is no file on disk. `C:/repos/datadinosaur/tools/blog/cdp.py` drives
real Chrome over the DevTools Protocol and writes actual PNG files (run from that directory,
or add it to `sys.path`):

```python
import cdp
cdp.launch(headless=True)             # non-headless when a human must sign in
t = cdp.Tab(); t.size(1600, 1000)     # deviceScaleFactor 2 by default, so text stays crisp
t.goto("https://example.com/page", wait=20)
print(t.shot("images/page.png"))                    # whole viewport
print(t.shot("images/panel.png", clip=t.box("#panel"), pad=10))   # one element
```

It is a self-contained ~150 lines including a hand-rolled WebSocket client, so it needs no
Playwright or Selenium. Points that will cost time otherwise:

- It uses its own profile at `.chrome-profile`, isolated from the everyday browser, so it starts
  with no sessions. Signing in elsewhere does not carry over.
- For anything behind a login, launch with `headless=False` and let the user sign in themselves.
  Never type their credentials. Passkey and 2FA challenges are theirs to complete, and a fresh
  profile triggers them.
- `Tab(reuse=True)` attaches to an arbitrary existing tab. Do navigate-then-screenshot inside one
  process holding one `Tab`, or a later call will screenshot whatever page happens to be first
  and save it under the wrong name.
- Console UIs render slowly. `wait=20` or more for a cloud console; verify with
  `t.js("document.body.innerText")` before trusting the capture.
- Expand what matters before shooting. A collapsed JSON node or an unfiltered table wastes the
  screenshot; click it via `t.js("...")`, sleep, then shoot.
- Set `PYTHONIOENCODING=utf-8` when printing page text on Windows, or a stray glyph raises
  `UnicodeEncodeError` and kills the run after the navigation but before the capture.

**Verifying the published post.** Check the page and every image over HTTP afterwards. Use
PowerShell's `Invoke-WebRequest -Method Head`, not `curl` — Git Bash curl fails with
`curl: (43)` when `-o /dev/null` is combined with `-w`, which looks exactly like every URL being
unreachable when the site is fine.

### Adding a quiz (only when the user asks)

If — and only if — the user asks for a quiz (e.g. "with a quiz at the end", "add a quiz", "make it a quiz post"), embed an interactive quiz using a `:::quiz` block in the Markdown body. Don't add one unprompted.

Syntax — wrap questions between `:::quiz` and `:::` markers:

```
:::quiz
Q: What sits at the hub of the DAMA wheel?
* Data Governance
> Correct — it directs and aligns every other knowledge area.
- Data Quality
> A spoke, not the hub.
- Metadata
> Foundational, but governance sits at the center.

Q: Is AI an official DAMA pillar yet?
* No, DAMA is still deciding where it fits
- Yes, it's the twelfth pillar
:::
```

- `Q:` starts a question; `-` is a wrong option; `*` marks the single correct option.
- `>` is an optional one-line explanation, and where you put it decides its scope:
  - A `>` **after all the options** (or right under the `Q:` line) is a **general note** shown after any answer — this is the simplest style: one combined explanation per question.
  - A `>` **between two options** (i.e. with another option after it) is a **per-option note** that attaches to the option directly above it, shown only when the reader picks that option.
  - So: one `>` at the end = general; a `>` under each option = per-option. Don't mix a trailing general note into a per-option question (a trailing `>` there attaches to the last option).
  - Markdown links in explanations render as links: `Source: [Beam docs](https://…)`.
  - Explanations are entirely optional — omit them and the question just marks right/wrong.
- Single-answer multiple choice only. Give each question 3–4 options and exactly one `*`. A question needs at least two options and a `*` or it's silently dropped.
- Put as many `Q:` groups in one block as you want (3–6 is a good quiz). You can place the block at the end of the post or inline after a relevant section.
- Keep option/explanation text on one line each — no Markdown inside options.

What it does automatically (no extra work needed): immediate per-question right/wrong feedback, the ability to retry a wrong answer by simply clicking a different option (the leaderboard score uses the first attempt; retries are just for learning), an anonymous score histogram with the reader's score highlighted, and a Retake button. The quiz text (questions, answers, explanations) is part of the post's Markdown, so it's indexed for the RAG chat like any other content.

When a post includes a quiz, write the questions to genuinely test the post's key points — pull them from claims actually made in the body, and use the `>` explanation to reinforce the takeaway.

## Step 3 — Preview and confirm

Before publishing anything, show the user a preview:

1. Display the full blog post content in a markdown code block
2. Then show the LinkedIn teaser text that will be posted (150–300 chars)
3. Ask the user:

> **Ready to publish?**
> - Blog post: www.datadinosaur.com
> - LinkedIn: posted as above
>
> Type **y** to publish both, **n** to cancel.

Wait for the user's response. If they type **n** (or anything other than **y**), stop and tell them nothing was published. Only proceed to Step 4 if they confirm with **y**.

## Step 4 — Publish to the live site

Use PowerShell's `Invoke-WebRequest`. Two things that will bite you if you skip them:

1. **Normalize punctuation first.** The publish API returns a 500 (empty body) on a full-length payload containing certain non-ASCII punctuation — confirmed culprit: the U+2212 MINUS SIGN `−` (a WAF/typography quirk; the same char passes in isolation but reliably 500s inside a real post). Replace it and a couple of other usual suspects with ASCII before posting. Em-dashes (`—`), en-dashes (`–`), `≥`, `≤`, and curly quotes are fine — leave those.
2. **Send the body as UTF-8 bytes** with an explicit charset, or em-dashes/symbols can corrupt.

```powershell
# $content holds the full Markdown body. Strip the punctuation the API chokes on:
$content = $content.Replace([char]0x2212, '-').Replace([char]0x00A0, ' ')

$body = @{
  title    = "<generated title>"
  excerpt  = "<generated excerpt>"
  content  = $content
  category = "<one of the five categories>"
  status   = "published"
} | ConvertTo-Json -Depth 5

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$resp = Invoke-WebRequest -Uri "https://www.datadinosaur.com/api/publish" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json; charset=utf-8"; "X-Api-Token" = "<APP_SECRET>" } `
  -Body $bytes `
  -UseBasicParsing
$resp.Content   # JSON: { "ok": true, "id": N, "slug": "...", "url": "https://www.datadinosaur.com/blog/..." }
```

The response JSON's `url` field is the published post URL — use it in the LinkedIn cross-post below. If you still get a 500 with an empty body, suspect another stray non-ASCII punctuation char in the content; isolate it by replacing non-ASCII with ASCII equivalents.

## Step 5 — Cross-post to LinkedIn

After the blog post is published and you have the URL, craft a short LinkedIn teaser (150–300 characters) that hooks the article. Use the excerpt as a starting point and end with the blog URL.

**Always finish the teaser with 3–5 relevant hashtags** (e.g. `#AI #MLOps #DataEngineering #LLMOps`). Hashtags are required on every post — pick ones that fit the topic.

**Never include the dinosaur emoji (🦕) or any other emoji** — emojis don't render correctly on LinkedIn. Plain text + blog URL + hashtags only.

**Building a social card.** Where the story is cause and effect, one image carrying both beats
either alone. `C:/repos/datadinosaur/tools/blog/composite_card.py` joins two screenshots side by
side, with an optional strip underneath for the log line or payload behind them:

```
python C:/repos/datadinosaur/tools/blog/composite_card.py   --left app.png --right alert.png --out card.png   --title "A blocked prompt, and the alert it raised"   --label-left "1 - the app" --label-right "2 - the notification"   --strip-title "3 - the event behind both" --strip-line '{"filters": ["sdp"]}'
```

It only scales and places the captures, so the card stays evidence rather than illustration.
`--help` lists the rest: subtitle, notes under the right capture, footer, column widths.

**Always ask the user whether to include an image before posting:**

> Want to include an image in the LinkedIn post? It has to be attached now — LinkedIn can't add one after the post is created. If so, give me a file path to the image; otherwise I'll post text-only.

- If the user declines or gives no image → post text-only with `shareMediaCategory = "NONE"` (Snippet A).
- If the user gives a readable image **file path** → run the 3-step upload and reference the asset with `shareMediaCategory = "IMAGE"` (Snippet B).
- A pasted chat image is NOT a readable byte stream — you need a real file path on disk. If only a pasted image exists, ask the user to save it locally and give you the path.

### Snippet A — text-only

```powershell
$linkedInBody = @{
  author = "<LINKEDIN_MEMBER_ID from .env>"
  lifecycleState = "PUBLISHED"
  specificContent = @{
    "com.linkedin.ugc.ShareContent" = @{
      shareCommentary = @{ text = "<teaser + blog URL + hashtags>" }
      shareMediaCategory = "NONE"
    }
  }
  visibility = @{ "com.linkedin.ugc.MemberNetworkVisibility" = "PUBLIC" }
} | ConvertTo-Json -Depth 10
$bytes = [System.Text.Encoding]::UTF8.GetBytes($linkedInBody)
Invoke-WebRequest -Uri "https://api.linkedin.com/v2/ugcPosts" -Method POST `
  -Headers @{ "Authorization"="Bearer <LINKEDIN_ACCESS_TOKEN>"; "Content-Type"="application/json"; "X-Restli-Protocol-Version"="2.0.0" } `
  -Body $bytes -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Snippet B — with an image (register → upload → attach)

```powershell
$token   = "<LINKEDIN_ACCESS_TOKEN>"
$owner   = "<LINKEDIN_MEMBER_ID from .env>"
$imgPath = "<absolute path to the image file>"

# 1) Register the image upload
$reg = @{ registerUploadRequest = @{
  recipes = @("urn:li:digitalmediaRecipe:feedshare-image")
  owner = $owner
  serviceRelationships = @(@{ relationshipType="OWNER"; identifier="urn:li:userGeneratedContent" })
} } | ConvertTo-Json -Depth 10
$regResp = Invoke-RestMethod -Uri "https://api.linkedin.com/v2/assets?action=registerUpload" -Method POST `
  -Headers @{ "Authorization"="Bearer $token"; "Content-Type"="application/json" } `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($reg))
$asset     = $regResp.value.asset
$uploadUrl = $regResp.value.uploadMechanism.'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'.uploadUrl

# 2) Upload the image bytes to the one-time URL
Invoke-WebRequest -Uri $uploadUrl -Method POST `
  -Headers @{ "Authorization"="Bearer $token" } `
  -InFile $imgPath -ContentType "application/octet-stream" -UseBasicParsing | Out-Null

# 3) Create the post referencing the uploaded asset
$linkedInBody = @{
  author = $owner
  lifecycleState = "PUBLISHED"
  specificContent = @{ "com.linkedin.ugc.ShareContent" = @{
    shareCommentary = @{ text = "<teaser + blog URL + hashtags>" }
    shareMediaCategory = "IMAGE"
    media = @(@{ status="READY"; media=$asset; title=@{ text="<short title>" }; description=@{ text="<short alt text>" } })
  } }
  visibility = @{ "com.linkedin.ugc.MemberNetworkVisibility" = "PUBLIC" }
} | ConvertTo-Json -Depth 12
$bytes = [System.Text.Encoding]::UTF8.GetBytes($linkedInBody)
Invoke-WebRequest -Uri "https://api.linkedin.com/v2/ugcPosts" -Method POST `
  -Headers @{ "Authorization"="Bearer $token"; "Content-Type"="application/json"; "X-Restli-Protocol-Version"="2.0.0" } `
  -Body $bytes -UseBasicParsing | Select-Object -ExpandProperty Content
```

If LinkedIn returns 401, the token has expired — tell the user and skip to the **LinkedIn token expired** section. The blog post is already live.

## Step 6 — Report back

Tell the user:

> Published! 🦕 [Title](url)
> Also posted to LinkedIn.

If the blog publish failed, show the error and suggest checking that the VM is running and APP_SECRET matches.
If the LinkedIn post failed, show the error — the blog post is still live, just note that LinkedIn cross-posting failed.

---

## LinkedIn token missing or expired

If `LINKEDIN_ACCESS_TOKEN` is missing or LinkedIn returns 401, tell the user:

> Your LinkedIn token needs to be refreshed (~60 day lifetime). To refresh it:
>
> 1. Go to this URL in your browser and approve the app:
>    `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=8643jqiu1ia52g&redirect_uri=https://localhost&scope=w_member_social%20openid%20profile`
> 2. When the browser shows "localhost refused to connect", copy the `code=...` value from the address bar and paste it here
> 3. I will exchange it for a new token, extract your member ID from the `id_token` JWT (`sub` field = member ID, URN = `urn:li:person:<sub>`), and update both `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_MEMBER_ID` in `.env`

Note: `LINKEDIN_MEMBER_ID` is `urn:li:person:ConC-yG5Nt` — this never changes, so only `LINKEDIN_ACCESS_TOKEN` needs updating on subsequent refreshes.

Then stop — do not attempt to publish anything until the token is refreshed.
