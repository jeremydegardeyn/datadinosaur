"""Join two screenshots into one social card: cause on the left, effect on the right.

Built for LinkedIn, where a single image has to carry the story. The two captures are only
scaled and placed, never redrawn, so the card stays evidence rather than illustration. The
optional strip underneath is for quoting the log line, payload or command behind the pair.

    python composite_card.py --left app.png --right alert.png --out card.png \
      --title "A blocked prompt, and the alert it raised" \
      --label-left "1 - the app" --label-right "2 - the notification" \
      --strip-title "3 - the event behind both" --strip-line '{"filters": ["sdp"]}'
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG, INK, MUTED, ACCENT, CARD = (14, 17, 23), (230, 233, 238), (152, 162, 177), (217, 123, 133), (23, 27, 34)
PAD, GUTTER = 60, 64


def font(name: str, size: int):
    for candidate in (name, "segoeui.ttf"):
        try:
            return ImageFont.truetype(rf"C:\Windows\Fonts\{candidate}", size)
        except OSError:
            continue
    return ImageFont.load_default()


def to_width(path: Path, width: int) -> Image.Image:
    im = Image.open(path).convert("RGB")
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


def build(a: argparse.Namespace) -> Image.Image:
    left, right = to_width(a.left, a.left_width), to_width(a.right, a.right_width)

    f_title, f_sub = font("segoeuib.ttf", 58), font("segoeui.ttf", 30)
    f_label, f_mono = font("segoeuib.ttf", 30), font("consola.ttf", 25)

    top = 168 if a.title else 90
    if a.subtitle:
        top += 70
    # The right column is a group: its capture plus whatever it produced downstream.
    rgroup = right.height + (30 + len(a.right_note) * 38 if a.right_note else 0)
    band = max(left.height, rgroup)
    strip_h = (86 + len(a.strip_line) * 34) if (a.strip_title or a.strip_line) else 0

    W = PAD * 2 + a.left_width + GUTTER + a.right_width
    H = top + band + (54 + strip_h if strip_h else 0) + (56 if a.footer else 0) + PAD

    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)

    if a.title:
        d.text((PAD, 52), a.title, font=f_title, fill=INK)
    if a.subtitle:
        d.text((PAD, 118), a.subtitle, font=f_sub, fill=MUTED)

    lx, rx = PAD, PAD + a.left_width + GUTTER
    ly = top + (band - left.height) // 2
    if a.label_left:
        d.text((lx, top - 46), a.label_left, font=f_label, fill=ACCENT)
    canvas.paste(left, (lx, ly))
    d.rectangle([lx - 1, ly - 1, lx + left.width, ly + left.height], outline=(40, 46, 57))

    ry = top + (band - rgroup) // 2
    if a.label_right:
        d.text((rx, top - 46), a.label_right, font=f_label, fill=ACCENT)
    canvas.paste(right, (rx, ry))
    d.rectangle([rx - 1, ry - 1, rx + right.width, ry + right.height], outline=(40, 46, 57))
    for i, line in enumerate(a.right_note):
        d.text((rx, ry + right.height + 26 + i * 38), line, font=f_sub, fill=MUTED)

    if not a.no_arrow:
        ax, ay = lx + a.left_width + GUTTER // 2, ry + right.height // 2
        d.line([ax - 16, ay, ax + 12, ay], fill=ACCENT, width=5)
        d.polygon([(ax + 22, ay), (ax + 6, ay - 12), (ax + 6, ay + 12)], fill=ACCENT)

    if strip_h:
        sy = top + band + 54
        d.rounded_rectangle([PAD, sy, W - PAD, sy + strip_h - 30], 8, fill=CARD)
        if a.strip_title:
            d.text((PAD + 28, sy + 22), a.strip_title, font=f_label, fill=ACCENT)
        for i, line in enumerate(a.strip_line):
            d.text((PAD + 28, sy + (70 if a.strip_title else 26) + i * 34), line, font=f_mono, fill=INK)

    if a.footer:
        d.text((PAD, H - PAD - 4), a.footer, font=f_sub, fill=MUTED)
    return canvas


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--left", type=Path, required=True, help="the cause: app, prompt, command")
    ap.add_argument("--right", type=Path, required=True, help="the effect: alert, ticket, output")
    ap.add_argument("--out", type=Path, default=Path("card.png"))
    ap.add_argument("--title"), ap.add_argument("--subtitle")
    ap.add_argument("--label-left"), ap.add_argument("--label-right")
    ap.add_argument("--right-note", action="append", default=[],
                    help="line under the right capture; repeatable")
    ap.add_argument("--strip-title")
    ap.add_argument("--strip-line", action="append", default=[],
                    help="monospace line in the footer strip; repeatable")
    ap.add_argument("--footer")
    ap.add_argument("--left-width", type=int, default=1250)
    ap.add_argument("--right-width", type=int, default=1120)
    ap.add_argument("--no-arrow", action="store_true")
    a = ap.parse_args()

    for p in (a.left, a.right):
        if not p.exists():
            raise SystemExit(f"missing: {p}")
    img = build(a)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out)
    print(f"{a.out}  {img.width}x{img.height}  aspect {img.width / img.height:.2f}:1  "
          f"({a.out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
