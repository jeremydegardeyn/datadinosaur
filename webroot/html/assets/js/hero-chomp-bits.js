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

  // Fire the bursts from INSIDE the rAF loop by sampling the SVG's own SMIL clock
  // (svg.getCurrentTime()) — the exact timeline that drives the jaw, so the spray
  // can't drift from the chomp. rAF is suspended while the tab is hidden, so we
  // simply stop sampling then: no events fire, no timers queue, nothing builds up
  // and floods on return. (Earlier attempts used SMIL events + setTimeout, which
  // the browser throttled-and-flushed on return; and document.timeline, which is a
  // different clock that drifts from SMIL.)
  var svg    = document.querySelector('.hero-dino-svg');
  var BEGIN  = 4, PERIOD = 6;            // jaw begins 4s, loops every 6s (seconds)
  var OFFS   = [1.49, 2.03, 2.57];       // chomp-snap offsets within the cycle
  var WINDOW = 0.35;                     // only fire near the offset, so a late return
                                         // doesn't replay already-passed chomps
  var lastCycle = -1, fired = [false, false, false];

  // The "t" and "a" chomp squish are driven here too, off the same SMIL clock,
  // rather than CSS @keyframes — CSS animations run on the document timeline,
  // which keeps advancing while the tab is hidden and so drifts out of sync with
  // the jaw. Per-cycle keyframes as [pos, ...values]; smoothstep between them
  // approximates the old ease-in-out.
  var tEl = document.querySelector('.dd-t');
  var aEl = document.querySelector('.dd-a');
  var T_KF = [[0,0,1,1],[0.08,0,1,1],[0.18,-3,1,0.995],[0.245,-3,1,0.995],[0.27,-4,1,0.99],[0.30,-3,1,0.995],[0.335,-3,1,0.995],[0.36,-4,1,0.99],[0.39,-3,1,0.995],[0.425,-3,1,0.995],[0.45,-4.5,1.01,0.99],[0.48,-3,1,0.995],[0.58,0,1,1],[1,0,1,1]];
  var A_KF = [[0,1,1],[0.08,1,1],[0.18,1.04,0.91],[0.26,1.04,0.91],[0.29,1.06,0.86],[0.32,1.04,0.91],[0.355,1.04,0.91],[0.38,1.07,0.84],[0.41,1.04,0.91],[0.445,1.04,0.91],[0.47,1.05,0.88],[0.50,1.04,0.91],[0.58,1,1],[1,1,1]];
  function ease(x) { return x * x * (3 - 2 * x); }
  function sample(kf, prog, out) {
    var i = 0;
    while (i < kf.length - 2 && prog >= kf[i + 1][0]) i++;
    var a = kf[i], b = kf[i + 1], span = b[0] - a[0];
    var lt = span > 0 ? ease((prog - a[0]) / span) : 0;
    for (var k = 1; k < a.length; k++) out[k - 1] = a[k] + (b[k] - a[k]) * lt;
  }
  var tv = [0, 0, 0], av = [0, 0];

  (function loop() {
    requestAnimationFrame(loop);
    step(cb, backP);
    step(cf, frontP);

    if (document.hidden || !svg || !svg.getCurrentTime) return;
    var t = svg.getCurrentTime() - BEGIN;

    // squish (only once the chomp loop has begun at 4s)
    if (t < 0) {
      if (tEl) tEl.style.transform = '';
      if (aEl) aEl.style.transform = '';
    } else {
      var prog = (t % PERIOD) / PERIOD;
      if (tEl) { sample(T_KF, prog, tv); tEl.style.transform = 'rotate(' + tv[0].toFixed(3) + 'deg) scaleX(' + tv[1].toFixed(4) + ') scaleY(' + tv[2].toFixed(4) + ')'; }
      if (aEl) { sample(A_KF, prog, av); aEl.style.transform = 'scale(' + av[0].toFixed(4) + ',' + av[1].toFixed(4) + ')'; }
    }

    if (t < 0) return;
    var cyc = Math.floor(t / PERIOD), phase = t - cyc * PERIOD;
    if (cyc !== lastCycle) { lastCycle = cyc; fired = [false, false, false]; }
    for (var i = 0; i < OFFS.length; i++) {
      if (!fired[i] && phase >= OFFS[i] && phase < OFFS[i] + WINDOW) {
        fired[i] = true; burst();
      }
    }
  })();
})();
