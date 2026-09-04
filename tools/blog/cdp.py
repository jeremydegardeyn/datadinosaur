"""Minimal Chrome DevTools Protocol driver over a hand-rolled WebSocket client.

Exists because there is no playwright/selenium here, but Chrome is installed. Launches a
Chrome with its OWN user-data-dir so the user can sign in to Google/ServiceNow once and
every later capture reuses that session, and writes real PNGs to disk rather than returning
images into a conversation that cannot save them.
"""
from __future__ import annotations

import base64, json, os, socket, struct, subprocess, sys, time, urllib.request
from pathlib import Path

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE = Path(os.environ.get("CDP_PROFILE", r"C:\claude\blog-evidence\.chrome-profile"))
PORT = int(os.environ.get("CDP_PORT", "9222"))


# ---------------------------------------------------------------- websocket

class WS:
    def __init__(self, url: str):
        _, rest = url.split("://", 1)
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.s = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n".encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.s.recv(65536)
            if not chunk:
                raise ConnectionError("socket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, obj: dict) -> None:
        data = json.dumps(obj).encode()
        n = len(data)
        hdr = b"\x81"
        if n < 126:
            hdr += struct.pack("!B", 0x80 | n)
        elif n < 1 << 16:
            hdr += struct.pack("!BH", 0x80 | 126, n)
        else:
            hdr += struct.pack("!BQ", 0x80 | 127, n)
        mask = os.urandom(4)
        self.s.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self) -> dict:
        while True:
            b0, b1 = self._read(2)
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack("!H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack("!Q", self._read(8))[0]
            payload = self._read(n)
            if b0 & 0x0F == 1:                      # text frame
                return json.loads(payload)
            if b0 & 0x0F == 8:                      # close
                raise ConnectionError("websocket closed by peer")


# ---------------------------------------------------------------- chrome

def launch(headless: bool = False) -> None:
    """Start Chrome on the debug port if it is not already listening."""
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2)
        return
    except Exception:
        pass
    PROFILE.mkdir(parents=True, exist_ok=True)
    args = [CHROME, f"--remote-debugging-port={PORT}", f"--user-data-dir={PROFILE}",
            "--no-first-run", "--no-default-browser-check", "--hide-crash-restore-bubble",
            "--disable-features=Translate,MediaRouter"]
    if headless:
        args += ["--headless=new", "--disable-gpu"]
    subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=2)
            return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("chrome did not come up on the debug port")


class Tab:
    def __init__(self, url: str = "about:blank", reuse: bool = False):
        if reuse:
            pages = [t for t in json.load(urllib.request.urlopen(
                f"http://127.0.0.1:{PORT}/json/list")) if t["type"] == "page"]
            t = pages[0]
        else:
            # Chrome >=111 requires PUT on /json/new; GET returns 405.
            req = urllib.request.Request(
                f"http://127.0.0.1:{PORT}/json/new?{urllib.parse.quote(url, safe='')}",
                method="PUT")
            t = json.load(urllib.request.urlopen(req))
        self.id = t["id"]
        self.ws = WS(t["webSocketDebuggerUrl"])
        self._n = 0
        self.call("Page.enable")
        self.call("Runtime.enable")

    def call(self, method: str, **params) -> dict:
        self._n += 1
        mid = self._n
        self.ws.send({"id": mid, "method": method, "params": params})
        while True:
            msg = self.ws.recv()
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def goto(self, url: str, wait: float = 3.0) -> None:
        self.call("Page.navigate", url=url)
        time.sleep(wait)

    def js(self, expr: str):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True,
                      returnByValue=True)
        return r.get("result", {}).get("value")

    def size(self, w: int, h: int, dsf: int = 2) -> None:
        self.call("Emulation.setDeviceMetricsOverride", width=w, height=h,
                  deviceScaleFactor=dsf, mobile=False)

    def box(self, selector: str) -> dict:
        r = self.js("(()=>{const e=document.querySelector(%r);if(!e)return null;"
                    "const b=e.getBoundingClientRect();"
                    "return JSON.stringify({x:b.x,y:b.y,width:b.width,height:b.height});})()"
                    % selector)
        if not r:
            raise RuntimeError(f"no element matches {selector}")
        return json.loads(r)

    def shot(self, path: str, full: bool = False, clip: dict | None = None,
             pad: int = 0) -> str:
        kw = {"format": "png"}
        if full:
            kw["captureBeyondViewport"] = True
        if clip:
            kw["clip"] = {"x": max(0, clip["x"] - pad), "y": max(0, clip["y"] - pad),
                          "width": clip["width"] + 2 * pad,
                          "height": clip["height"] + 2 * pad, "scale": 1}
            kw["captureBeyondViewport"] = True
        data = self.call("Page.captureScreenshot", **kw)["data"]
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(base64.b64decode(data))
        return f"{p}  ({p.stat().st_size // 1024} KB)"


import urllib.parse  # noqa: E402  (used in Tab.__init__)

if __name__ == "__main__":
    launch(headless="--headless" in sys.argv)
    t = Tab("about:blank")
    t.size(1280, 800)
    t.goto("https://example.com")
    print(t.shot("images/_selftest.png"))
    print("title:", t.js("document.title"))
