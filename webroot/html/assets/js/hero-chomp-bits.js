/* DataDinosaur — hero-chomp-bits.js
   White "chomp bits" that spray out of the dino's mouth on each chomp. Some go
   to a canvas behind the dino/letters, some to one in front, so the spray reads
   with depth. Synced to the SVG chomp loop: first cycle at 5.47s, then every 6s,
   three little bursts per cycle (one per chomp). Origin tracks the real mouth
   via the invisible #hero-chomp-origin marker, so it stays put at any scale. */
'use strict';

(function () {
  var wrap   = document.querySelector('.hero-dino-wrap');
  var back   = document.getElementById('hero-chomp-back');
  var front  = document.getElementById('hero-chomp-front');
  var origin = document.getElementById('hero-chomp-origin');
  if (!wrap || !back || !front || !origin) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cb = back.getContext('2d');
  var cf = front.getContext('2d');
  var W = 0, H = 0, scale = 1;

  function resize() {
    W = wrap.offsetWidth  || 360;
    H = wrap.offsetHeight || 200;
    back.width = front.width = W;
    back.height = front.height = H;
    scale = W / 700;   // velocities were tuned at ~700px wide
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Mouth position in canvas pixels, read fresh each burst (robust to layout).
  function spot() {
    var o = origin.getBoundingClientRect();
    var c = back.getBoundingClientRect();
    return { x: o.left + o.width / 2 - c.left, y: o.top + o.height / 2 - c.top };
  }

  var backP = [], frontP = [];

  // Drop everything if the tab goes hidden, so we never come back to a backlog.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { backP.length = 0; frontP.length = 0; }
  });

  function burst() {
    var m = spot();
    for (var i = 0; i < 18; i++) {
      var a  = -Math.PI / 2 + 0.35 + (Math.random() - 0.5) * 3.0;
      var sp = (1.6 + Math.random() * 3.6) * scale;
      var p = {
        x : m.x + (Math.random() - 0.5) * 14 * scale,
        y : m.y + (Math.random() - 0.5) * 6  * scale,
        vx: Math.cos(a) * sp + 0.4 * scale,
        vy: Math.sin(a) * sp - 1.0 * scale,
        life: 1,
        sz: (1.3 + Math.random() * 2.3) * Math.max(scale, 0.5)
      };
      (Math.random() < 0.45 ? backP : frontP).push(p);
    }
  }

  function step(ctx, arr) {
    ctx.clearRect(0, 0, W, H);
    for (var i = arr.length - 1; i >= 0; i--) {
      var p = arr[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.18 * scale; p.life -= 0.02;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#eef6ff';
      ctx.fillRect(p.x, p.y, p.sz, p.sz);
    }
    ctx.globalAlpha = 1;
  }

  // Schedule the three bursts per chomp off document.timeline — the same clock
  // the SVG/CSS animations use. It pauses when the tab is hidden, so the bits
  // stay in sync with the jaw and never accumulate a backlog (unlike setInterval,
  // which keeps firing in the background while rAF is paused).
  var BEGIN = 4500, PERIOD = 6000;       // SVG chomp: begins 4.5s, loops every 6s
  var OFFS  = [1470, 2010, 2550];        // first bits at 5.97s, then +0.54s, +1.08s
  var clock = function () {
    return (document.timeline && document.timeline.currentTime != null)
      ? document.timeline.currentTime : performance.now();
  };
  var lastCycle = -1, fired = [false, false, false];

  (function loop() {
    requestAnimationFrame(loop);
    step(cb, backP);
    step(cf, frontP);

    if (document.hidden) return;
    var t = clock() - BEGIN;
    if (t < 0) return;
    var cyc = Math.floor(t / PERIOD), phase = t - cyc * PERIOD;
    if (cyc !== lastCycle) { lastCycle = cyc; fired = [false, false, false]; }
    for (var i = 0; i < OFFS.length; i++) {
      if (!fired[i] && phase >= OFFS[i]) { fired[i] = true; burst(); }
    }
  })();
})();
