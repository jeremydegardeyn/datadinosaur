(function () {
  'use strict';

  // ── Physics constants ──────────────────────────────────────────────────────
  var GRAVITY    = 0.65;  // SVG units / frame²
  var DAMPING    = 0.52;  // velocity kept after each bounce
  var SETTLE_V   = 1.0;   // bounce becomes a rest below this speed
  var START_MS   = 300;   // ms before first letter drops
  var STAGGER_MS = 90;    // ms between successive letters

  // ── Per-letter config  (D a t a i n o s a u r) ───────────────────────────
  // startH : how far above (SVG units) the letter begins
  // type   : 'bounce' | 'spin' | 'wobble' | 'orbit'
  var CFG = [
    // D — falls straight, slight counter-clockwise tumble, 3 bounces
    { type:'bounce', startH:210, bounceMax:3, rotSpd:-3,   fallMult:1.05, driftX: 0    },
    // a — spins like a top the whole way down
    { type:'spin',   startH:185, bounceMax:2, spinSpd:18,  fallMult:0.85               },
    // t — tall letter, many small bounces, drifts slightly left
    { type:'bounce', startH:230, bounceMax:6, rotSpd: 7,   fallMult:0.70, driftX:-0.8  },
    // a — rolls in a wide circle as it descends (orbit)
    { type:'orbit',  startH:200, bounceMax:2, orbitR:20,   dir: 1,        fallMult:0.90},
    // i — lightest, highest start, 7 springy bounces
    { type:'bounce', startH:255, bounceMax:7, rotSpd:-2.5, fallMult:0.55, driftX: 0.4  },
    // n — medium, 3 bounces, drifts right
    { type:'bounce', startH:200, bounceMax:3, rotSpd: 4.5, fallMult:1.10, driftX: 0.8  },
    // o — full 2-circle orbit on the way down (round letter = round path!)
    { type:'orbit',  startH:195, bounceMax:2, orbitR:18,   dir:-1,        fallMult:0.95},
    // s — counter-spin, fast
    { type:'spin',   startH:215, bounceMax:2, spinSpd:-22, fallMult:0.92               },
    // a — wobbles side to side like a leaf
    { type:'wobble', startH:190, bounceMax:4, wobAmp:14,   wobFreq:0.11, fallMult:0.85 },
    // u — heaviest, fastest fall, 2 hard bounces
    { type:'bounce', startH:240, bounceMax:2, rotSpd:-5.5, fallMult:1.35, driftX:-0.5  },
    // r — fastest spin, big slowdown on landing
    { type:'spin',   startH:205, bounceMax:2, spinSpd:25,  fallMult:1.00               },
  ];

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

      var p = {
        el  : el,
        cx  : cx,            // pivot x in SVG coords
        cy  : cy,            // pivot y in SVG coords
        x   : 0,             // horizontal offset (SVG units, target = 0)
        y   : -c.startH,     // start above logo; target = 0
        vx  : 0,
        vy  : 0,
        rot : 0,
        rotSpd     : c.rotSpd || 0,
        settled    : false,
        startAt    : START_MS + i * STAGGER_MS,
        bouncesDone: 0,
        cfg : c,
        // orbit state
        orbitAngle : -Math.PI * 0.5,   // start at top of arc
        orbitFrac  : 0,                 // 0→1 through orbit revolutions
        // spin state
        spinCur : c.type === 'spin' ? c.spinSpd : 0,
        // wobble state
        wobT : 0,
      };

      // Initial x offset for bounce letters so they drift back to centre
      if (c.type === 'bounce' && c.driftX) {
        p.x  = c.driftX * 8;
        p.vx = -c.driftX * 0.5;
      }

      particles.push(p);
    }

    var t0 = null;

    function snap(p) {
      // smoothly snap to final resting place
      p.settled = true;
      p.el.style.transition = 'transform 0.25s ease-out';
      p.el.setAttribute('transform', '');
      setTimeout(function () { p.el.style.transition = ''; }, 260);
    }

    function applyTransform(p) {
      p.el.setAttribute(
        'transform',
        'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ')' +
        ' rotate(' + p.rot.toFixed(2) + ' ' + p.cx.toFixed(2) + ' ' + p.cy.toFixed(2) + ')'
      );
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
        var fm = c.fallMult || 1;

        // ── BOUNCE ────────────────────────────────────────────────────────
        if (c.type === 'bounce') {
          p.vy += GRAVITY * fm;
          if (p.vy > 32) p.vy = 32;
          p.y  += p.vy;
          p.x  += p.vx;
          p.vx *= 0.96;
          // rotation fades each bounce
          p.rot += p.rotSpd * Math.max(1 - p.bouncesDone * 0.18, 0.2);

          if (p.y >= 0) {
            p.y   = 0;
            p.vy *= -DAMPING;
            p.vx *= 0.55;
            p.rotSpd *= 0.45;
            p.bouncesDone++;
            if (Math.abs(p.vy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
              snap(p); continue;
            }
          }

        // ── SPIN (top) ────────────────────────────────────────────────────
        } else if (c.type === 'spin') {
          p.vy += GRAVITY * fm;
          if (p.vy > 28) p.vy = 28;
          p.y  += p.vy;
          p.spinCur *= 0.992;
          p.rot     += p.spinCur;

          if (p.y >= 0) {
            p.y       = 0;
            p.vy     *= -DAMPING * 0.7;
            p.spinCur *= 0.38;   // spin takes a hard hit on landing
            p.bouncesDone++;
            if (Math.abs(p.vy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
              snap(p); continue;
            }
          }

        // ── WOBBLE (leaf fall) ────────────────────────────────────────────
        } else if (c.type === 'wobble') {
          p.vy += GRAVITY * fm;
          if (p.vy > 25) p.vy = 25;
          p.y += p.vy;
          p.wobT += c.wobFreq;
          // x oscillates like a falling leaf; amplitude shrinks as it nears floor
          var proximity = Math.max(0, -p.y) / c.startH; // 1 far, 0 at floor
          p.x   = Math.sin(p.wobT) * c.wobAmp * proximity;
          p.rot = Math.sin(p.wobT) * 12 * proximity;

          if (p.y >= 0) {
            p.y  = 0;
            p.vy *= -DAMPING;
            p.bouncesDone++;
            if (Math.abs(p.vy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
              snap(p); continue;
            }
          }

        // ── ORBIT (corkscrew descent) ─────────────────────────────────────
        } else if (c.type === 'orbit') {
          p.vy += GRAVITY * fm;
          if (p.vy > 26) p.vy = 26;
          p.y += p.vy;

          // orbit radius shrinks as letter approaches its home (y → 0)
          var proximity2 = Math.max(0, -p.y) / c.startH; // 1 = far above, 0 = home
          var r = c.orbitR * proximity2;
          var spd = 0.10;
          p.orbitAngle += spd * c.dir;
          p.x   = Math.cos(p.orbitAngle) * r;
          p.rot += spd * c.dir * (180 / Math.PI) * 1.4;

          if (p.y >= 0) {
            p.y   = 0;
            p.vy *= -DAMPING * 0.6;
            p.bouncesDone++;
            if (Math.abs(p.vy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
              snap(p); continue;
            }
          }
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
