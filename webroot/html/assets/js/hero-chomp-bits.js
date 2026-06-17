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

  // Just render — no scheduling here. Particles age and clear on their own.
  (function loop() {
    requestAnimationFrame(loop);
    step(cb, backP);
    step(cf, frontP);
  })();

  // Trigger the three bursts per chomp off the jaw animation's OWN SMIL clock,
  // not a wall clock. begin/repeat events fire from the same timeline that drives
  // the visible jaw, so the spray can never drift from the chomp — and when the
  // tab is hidden the animation pauses, so no events fire and nothing backs up.
  // (The earlier document.timeline polling drifted because that clock and the
  // SMIL/CSS clocks pause differently when the tab is backgrounded.)
  var jaw  = document.getElementById('dino-jaw-anim');
  var OFFS = [1740, 2280, 2820];   // burst on each mouth-CLOSE (cycle keyTimes .29/.38/.47)
  function chomp() {
    OFFS.forEach(function (ms) {
      setTimeout(function () { if (!document.hidden) burst(); }, ms);
    });
  }
  if (jaw && jaw.addEventListener) {
    jaw.addEventListener('beginEvent', chomp);   // first cycle
    jaw.addEventListener('repeatEvent', chomp);  // every loop after
  }
})();
