(function () {
  'use strict';

  // ── Physics constants ──────────────────────────────────────────────────────
  var GRAVITY      = 0.55;   // SVG units / frame²
  var DAMPING      = 0.54;   // velocity kept on each bounce
  var SETTLE_V     = 1.1;    // stop bouncing below this speed
  var FALL_FLOOR   = 155;    // SVG units below each letter's center
  var START_DELAY  = 900;    // ms before the first letter moves
  var STAGGER      = 110;    // ms between successive letter starts

  // ── Per-letter behaviour config (one entry per letter: D a t a i n o s a u r)
  // type: 'bounce' | 'orbit' | 'spin'
  var CFG = [
    // D  — heavy, slow tumble, 3 big bounces
    { type:'bounce', bounceMax:3, rotSpd:-3.5, fallMult:1.05, hDrift: 1.2 },
    // a  — spins like a top while falling
    { type:'spin',   spinSpd:20,  fallMult:0.80 },
    // t  — tall and light, many small bounces
    { type:'bounce', bounceMax:6, rotSpd: 6,   fallMult:0.65, hDrift:-1.0 },
    // a  — rolls in a circle (1.75 revolutions) then falls
    { type:'orbit',  revs:1.75,   dir: 1,  radius:26 },
    // i  — tiny, springs up and down a lot
    { type:'bounce', bounceMax:7, rotSpd:-2.5, fallMult:0.50, hDrift: 0.5 },
    // n  — normal fall, 3 bounces, slight tilt
    { type:'bounce', bounceMax:3, rotSpd: 4.5, fallMult:1.10, hDrift: 0.8 },
    // o  — orbits 2 full circles (perfect for a round letter!)
    { type:'orbit',  revs:2.0,    dir:-1,  radius:22 },
    // s  — counter-spin, wiggles side to side on bounces
    { type:'spin',   spinSpd:-18, fallMult:0.90 },
    // a  — 4 bounces, drifts right
    { type:'bounce', bounceMax:4, rotSpd: 5,   fallMult:0.85, hDrift: 1.5 },
    // u  — falls fast, 2 solid bounces
    { type:'bounce', bounceMax:2, rotSpd:-5,   fallMult:1.30, hDrift:-0.8 },
    // r  — spins fast, decelerates dramatically
    { type:'spin',   spinSpd:24,  fallMult:1.0 },
  ];

  function init() {
    var els = document.querySelectorAll('.hero-letter');
    if (!els.length) return;

    // Build particle list
    var particles = [];
    for (var i = 0; i < els.length; i++) {
      var el  = els[i];
      var cfg = CFG[i] || CFG[0];
      var bb  = el.getBBox();
      var cx  = bb.x + bb.width  * 0.5;
      var cy  = bb.y + bb.height * 0.5;

      // Each letter gets a slightly different floor so they don't all land
      // at identical depths — adds a natural scattered look
      var floorDrop = FALL_FLOOR * (0.82 + i * 0.025 + Math.random() * 0.15);

      var p = {
        el : el,
        cx : cx,           // SVG-coord centre x (pivot for rotate)
        cy : cy,           // SVG-coord centre y
        x  : 0,            // current horizontal offset (SVG units)
        y  : 0,            // current vertical  offset (SVG units)
        vx : 0,
        vy : 0,
        rot: 0,            // rotation degrees
        settled   : false,
        startAt   : START_DELAY + i * STAGGER,
        floorDrop : floorDrop,
        bouncesDone: 0,
        cfg: cfg,
        // orbit-specific
        orbitAngle    : -Math.PI * 0.5,   // start at top of arc
        orbitTravelled: 0,
        orbitDone     : false,
        // spin-specific
        spinCurrent: cfg.type === 'spin' ? cfg.spinSpd : 0,
      };

      // Bounce: small random horizontal drift per letter
      if (cfg.type === 'bounce') {
        p.vx = (cfg.hDrift || 0) * 0.3;
      }

      particles.push(p);
    }

    var t0 = null;

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

        // ── BOUNCE ──────────────────────────────────────────────────────────
        if (c.type === 'bounce') {
          p.vy += GRAVITY * (c.fallMult || 1);
          if (p.vy > 32) p.vy = 32;
          p.y  += p.vy;
          p.x  += p.vx;
          p.vx *= 0.97;
          // rotation slows slightly each bounce
          var rotFade = 1 - p.bouncesDone * 0.12;
          p.rot += c.rotSpd * Math.max(rotFade, 0.25);

          if (p.y >= p.floorDrop) {
            p.y     = p.floorDrop;
            p.vy   *= -DAMPING;
            p.vx   *= 0.55;
            c.rotSpd *= 0.50;
            p.bouncesDone++;
            if (Math.abs(p.vy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
              p.vy = 0; p.vx = 0;
              p.settled = true;
            }
          }

        // ── ORBIT ───────────────────────────────────────────────────────────
        } else if (c.type === 'orbit') {
          if (!p.orbitDone) {
            var spd = 0.038;
            p.orbitAngle     += spd * c.dir;
            p.orbitTravelled += spd;
            var progress = p.orbitTravelled / (c.revs * Math.PI * 2);
            // drift downward gradually so orbit path itself descends
            var drop = progress * p.floorDrop * 0.55;
            p.x  = Math.cos(p.orbitAngle) * c.radius;
            p.y  = Math.sin(p.orbitAngle) * c.radius + drop;
            // roll rotation: one full spin per orbit
            p.rot += spd * c.dir * (180 / Math.PI) * 1.2;

            if (p.orbitTravelled >= c.revs * Math.PI * 2) {
              p.orbitDone = true;
              p.vy = 4;
            }
          } else {
            // fall from wherever orbit ended
            p.vy += GRAVITY;
            p.y  += p.vy;
            p.x  *= 0.94;                  // drift back toward centre
            p.rot += c.dir * 2.5;

            if (p.y >= p.floorDrop) {
              p.y   = p.floorDrop;
              p.vy *= -DAMPING * 0.55;
              if (Math.abs(p.vy) < SETTLE_V) {
                p.vy = 0;
                p.settled = true;
              }
            }
          }

        // ── SPIN (top) ──────────────────────────────────────────────────────
        } else if (c.type === 'spin') {
          p.vy += GRAVITY * (c.fallMult || 1);
          if (p.vy > 28) p.vy = 28;
          p.y  += p.vy;
          // spin decelerates like a real top losing energy
          p.spinCurrent *= 0.991;
          p.rot += p.spinCurrent;

          if (p.y >= p.floorDrop) {
            p.y          = p.floorDrop;
            p.vy        *= -DAMPING * 0.65;
            p.spinCurrent *= 0.42;  // big jolt on impact

            if (Math.abs(p.vy) < SETTLE_V) {
              p.vy = 0;
              p.settled = true;
            }
          }
        }

        // Apply SVG transform — units stay in SVG coordinate space
        p.el.setAttribute(
          'transform',
          'translate(' + p.x + ' ' + p.y + ') rotate(' + p.rot + ' ' + p.cx + ' ' + p.cy + ')'
        );
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
