(function () {
  'use strict';

  var GRAVITY  = 0.65;   // SVG units / frame²
  var SQUISH_F = 18;     // frames for squish recovery
  var SETTLE_V = 0.5;    // stop after this many bounces
  var START_MS = 300;

  // ── Per-letter config (D a t a i n o s a u r) ───────────────────────────
  // type 'straight' : goes straight up, no tilt
  // type 'tilt'     : leans a random direction each jump (never same twice)
  // type 'loop'     : drifts sideways in arc + slow spin
  var CFG = [
    { type:'straight', jumpV:-6.5, bounceMax:2 },             // D
    { type:'tilt',     jumpV:-7.5, rotAmp:11, bounceMax:3 },  // a  ← 3 jumps
    { type:'straight', jumpV:-5.5, bounceMax:2 },             // t
    { type:'tilt',     jumpV:-7.0, rotAmp: 9, bounceMax:2 },  // a
    { type:'straight', jumpV:-8.5, bounceMax:3 },             // i  — lightest
    { type:'tilt',     jumpV:-6.0, rotAmp: 8, bounceMax:3 },  // n  ← 3 jumps
    { type:'loop',     jumpV:-7.0, bounceMax:2 },              // o  ✦
    { type:'tilt',     jumpV:-7.5, rotAmp:12, bounceMax:2 },  // s
    { type:'straight', jumpV:-6.5, bounceMax:2 },             // a
    { type:'loop',     jumpV:-6.0, bounceMax:2 },              // u  ✦
    { type:'tilt',     jumpV:-8.0, rotAmp:10, bounceMax:3 },  // r  ← 3 jumps
  ];

  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function randSign() { return Math.random() < 0.5 ? 1 : -1; }
  // Bob strength for a given jump index, clamped to the per-dot list.
  function dotScaleFor(p, idx) {
    var a = p.dotScales;
    return a[Math.min(Math.max(idx, 0), a.length - 1)];
  }

  function init() {
    var els = document.querySelectorAll('.hero-letter');
    if (!els.length) return;

    var particles = [];

    for (var i = 0; i < els.length; i++) {
      var el  = els[i];
      var c   = CFG[i] || CFG[0];
      var bb  = el.getBBox();
      var cx  = bb.x + bb.width  * 0.5;
      var cy  = bb.y + bb.height * 0.5;
      var bot = bb.y + bb.height;
      // max height letter reaches on a full jump (used to derive tilt from position)
      var maxH = (c.jumpV * c.jumpV) / (2 * GRAVITY);

      // i/r tittles live inside the group; the "a" counters are mask shapes in
      // <defs>, referenced via the group's data-dot id.
      var dotEl = el.querySelector('.letter-dot')
        || (el.getAttribute('data-dot') ? document.querySelector(el.getAttribute('data-dot')) : null);
      // Per-dot bob strength, as a per-jump list (e.g. "0.22,0.45,0.22" = gentle
      // on jumps 1 and 3). A single value applies to every jump. Defaults to full
      // strength for the i/r tittles.
      var dsAttr = dotEl ? dotEl.getAttribute('data-dot-scale') : null;
      var dotScales = dsAttr ? dsAttr.split(',').map(function (v) {
        var n = parseFloat(v); return isNaN(n) ? 1 : n;
      }) : [1];

      particles.push({
        el  : el,
        dotEl: dotEl,
        dotScales: dotScales,
        cx  : cx, cy : cy, bot : bot,
        maxH: maxH,
        y   : 0,  vy : 0,
        x   : 0,
        rot : 0,
        tiltSign   : randSign(),   // randomised fresh each jump
        spinAngle  : 0,
        loopAngle  : 0,
        settled    : false,
        startAt    : START_MS + Math.random() * 500,  // random, not left-to-right
        bouncesDone: 0,
        squishF    : 0,
        sx : 1, sy : 1,
        nextVy     : 0,
        launched   : false,
        cfg : c,
      });
    }

    var t0 = null;

    function snap(p) {
      p.settled = true;
      p.el.style.transition = 'transform 0.22s ease-out';
      p.el.setAttribute('transform', '');
      if (p.dotEl) p.dotEl.setAttribute('transform', '');
      setTimeout(function () { p.el.style.transition = ''; }, 240);
    }

    function applyTransform(p) {
      var tf;
      if (p.squishF > 0) {
        // squish anchored at bottom-centre, no y offset (letter is at floor)
        tf = 'translate(' + p.cx    + ' ' + p.bot + ')' +
             ' scale('   + p.sx.toFixed(3) + ' ' + p.sy.toFixed(3) + ')' +
             ' translate(' + (-p.cx) + ' ' + (-p.bot) + ')';
      } else if (p.cfg.type === 'loop') {
        tf = 'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ')' +
             ' rotate('   + p.spinAngle.toFixed(2) + ' ' + p.cx + ' ' + p.cy + ')';
      } else {
        tf = 'translate(0 ' + p.y.toFixed(2) + ')' +
             ' rotate('  + p.rot.toFixed(2) + ' ' + p.cx + ' ' + p.cy + ')';
      }
      p.el.setAttribute('transform', tf);
    }

    function launch(p) {
      // Slight random variation in jump height so they don't feel mechanical
      p.vy        = p.cfg.jumpV * (0.90 + Math.random() * 0.20);
      p.tiltSign  = randSign();  // fresh random lean direction every jump
    }

    function frame(ts) {
      if (!t0) t0 = ts;
      var elapsed = ts - t0;
      var anyLive = false;

      for (var j = 0; j < particles.length; j++) {
        var p = particles[j];
        if (p.settled) continue;
        if (elapsed < p.startAt) { anyLive = true; continue; }
        anyLive = true;

        var c = p.cfg;

        if (!p.launched) { p.launched = true; launch(p); }

        // ── SQUISH phase ──────────────────────────────────────────────────
        if (p.squishF > 0) {
          p.squishF++;
          var sq = easeOut(Math.min(p.squishF / SQUISH_F, 1));
          p.sx = 1.38 + (1 - 1.38) * sq;
          p.sy = 0.52 + (1 - 0.52) * sq;

          // Dot: pushed extra downward at peak squish, eases back out
          if (p.dotEl) {
            var squishCurve = (p.squishF < SQUISH_F * 0.3)
              ? (p.squishF / (SQUISH_F * 0.3))
              : (1 - (p.squishF - SQUISH_F * 0.3) / (SQUISH_F * 0.7));
            var dotPush = squishCurve * 12 * dotScaleFor(p, p.bouncesDone - 1);
            p.dotEl.setAttribute('transform', 'translate(0 ' + dotPush.toFixed(2) + ')');
          }

          if (p.squishF >= SQUISH_F) {
            p.squishF = 0; p.sx = 1; p.sy = 1;
            if (p.dotEl) p.dotEl.setAttribute('transform', '');
            if (p.bouncesDone >= c.bounceMax) { snap(p); continue; }
            launch(p);   // new jump — fresh direction, similar height
          }
          applyTransform(p);
          continue;
        }

        // ── FLIGHT phase ──────────────────────────────────────────────────
        p.vy += GRAVITY;
        if (p.vy > 12) p.vy = 12;
        p.y  += p.vy;

        if (c.type === 'straight') {
          p.rot = 0;  // stays perfectly upright

        } else if (c.type === 'tilt') {
          // Rotation derived from height — peaks at top, zero at floor.
          // tiltSign is randomised each jump so it never leans the same way twice.
          var frac = Math.max(0, -p.y) / p.maxH;  // 0 at floor, 1 at peak
          p.rot = c.rotAmp * p.tiltSign * frac;

        } else if (c.type === 'loop') {
          var airFrac = Math.max(0, -p.y) / Math.abs(p.cfg.jumpV * 6);
          p.loopAngle += 0.07;
          p.x          = Math.sin(p.loopAngle) * 18 * airFrac;
          p.spinAngle += 5;
        }

        // Dot rides higher than the body during flight
        if (p.dotEl) {
          var dotExtra = p.y * 0.45 * dotScaleFor(p, p.bouncesDone);  // negative = higher up; zero at floor
          p.dotEl.setAttribute('transform', 'translate(0 ' + dotExtra.toFixed(2) + ')');
        }

        // ── Floor hit ─────────────────────────────────────────────────────
        if (p.y >= 0) {
          p.y = 0;
          if (c.type === 'loop') { p.x = 0; p.spinAngle *= 0.1; }
          p.rot = 0;
          p.bouncesDone++;
          p.squishF = 1;
          p.sx = 1.38; p.sy = 0.52;
        }

        applyTransform(p);
      }

      if (anyLive) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
