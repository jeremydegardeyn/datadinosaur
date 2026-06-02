(function () {
  'use strict';

  var GRAVITY      = 0.38;  // SVG units / frame² — slow, floaty
  var DAMPING      = 0.62;  // velocity kept after each squish-launch
  var SETTLE_V     = 1.0;   // give up bouncing below this speed
  var SQUISH_F     = 18;    // frames the squish animation takes
  var START_MS     = 400;

  // ── Per-letter config (D a t a i n o s a u r) ───────────────────────────
  // type 'hop'  : normal toddler bounce with lean
  // type 'loop' : jumps AND drifts sideways in a small arc while spinning
  var CFG = [
    { type:'hop',  jumpV:-6.5, rotAmp:  9, bounceMax:4 },  // D
    { type:'hop',  jumpV:-7.5, rotAmp: -7, bounceMax:5 },  // a
    { type:'hop',  jumpV:-5.5, rotAmp: 13, bounceMax:4 },  // t
    { type:'hop',  jumpV:-7.0, rotAmp: -8, bounceMax:4 },  // a
    { type:'hop',  jumpV:-9.0, rotAmp:  5, bounceMax:6 },  // i  — lightest
    { type:'hop',  jumpV:-6.0, rotAmp:  8, bounceMax:3 },  // n
    { type:'loop', jumpV:-7.0, bounceMax:3 },               // o  — loops and spins ✦
    { type:'hop',  jumpV:-7.5, rotAmp:-11, bounceMax:5 },  // s
    { type:'hop',  jumpV:-6.5, rotAmp:  7, bounceMax:4 },  // a
    { type:'loop', jumpV:-6.0, bounceMax:3 },               // u  — loops and spins ✦
    { type:'hop',  jumpV:-8.0, rotAmp:  9, bounceMax:5 },  // r
  ];

  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

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
      var bot = bb.y + bb.height;   // bottom edge — squish anchor

      // Random delay — not left-to-right, just scattered
      var startAt = START_MS + Math.random() * 900;

      particles.push({
        el  : el,
        cx  : cx, cy : cy, bot : bot,
        y   : 0,  vy : 0,
        x   : 0,                    // only used by 'loop' letters
        rot : 0,
        rotSpd     : 0,
        spinAngle  : 0,             // accumulated spin for 'loop' type
        loopAngle  : 0,             // orbit angle for x drift
        settled    : false,
        startAt    : startAt,
        bouncesDone: 0,
        squishF    : 0,             // >0 means squishing
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
      setTimeout(function () { p.el.style.transition = ''; }, 240);
    }

    function applyTransform(p) {
      var tf;
      if (p.squishF > 0) {
        // Scale from bottom-centre; no y offset (letter is at floor y=0)
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

        // First launch
        if (!p.launched) {
          p.launched = true;
          p.vy     = c.jumpV;
          p.rotSpd = c.type === 'hop' ? c.rotAmp * 0.14 : 0;
        }

        // ── SQUISH phase ────────────────────────────────────────────────
        if (p.squishF > 0) {
          p.squishF++;
          var sq = easeOut(Math.min(p.squishF / SQUISH_F, 1));
          p.sx = 1.38 + (1 - 1.38) * sq;
          p.sy = 0.52 + (1 - 0.52) * sq;

          if (p.squishF >= SQUISH_F) {
            p.squishF = 0;
            p.sx = 1; p.sy = 1;
            if (Math.abs(p.nextVy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
              snap(p); continue;
            }
            p.vy = p.nextVy;
          }
          applyTransform(p);
          continue;
        }

        // ── FLIGHT phase ────────────────────────────────────────────────
        p.vy += GRAVITY;
        if (p.vy > 12) p.vy = 12;
        p.y  += p.vy;

        if (c.type === 'hop') {
          // lean into direction of travel; decay each bounce
          var decay = Math.max(1 - p.bouncesDone * 0.28, 0.08);
          if (p.vy < 0) p.rot += p.rotSpd * decay;
          else          p.rot -= p.rotSpd * 0.55 * decay;

        } else if (c.type === 'loop') {
          // Drift sideways in a circular arc while spinning full rotations.
          // Radius shrinks as the letter descends back toward floor.
          var airFrac = Math.max(0, -p.y) / Math.abs(c.jumpV * 6); // 0→1 airborne
          p.loopAngle  += 0.07;
          p.x           = Math.sin(p.loopAngle) * 18 * airFrac;
          p.spinAngle  += 5;    // slow, dreamy spin
        }

        // ── Floor hit ───────────────────────────────────────────────────
        if (p.y >= 0) {
          p.y = 0;
          if (c.type === 'loop') p.x = 0;   // snap back to centre on landing
          p.bouncesDone++;
          p.squishF  = 1;           // start squish
          p.sx       = 1.38;
          p.sy       = 0.52;
          p.nextVy   = -p.vy * DAMPING;
          // spin slows dramatically on impact
          if (c.type === 'loop') p.spinAngle *= 0.1;
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
