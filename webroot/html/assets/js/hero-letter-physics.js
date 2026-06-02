(function () {
  'use strict';

  var GRAVITY    = 0.9;   // SVG units / frame²
  var DAMPING    = 0.58;  // energy kept on each floor hit
  var SETTLE_V   = 1.5;   // stop bouncing below this speed
  var START_MS   = 400;   // ms before first letter jumps
  var STAGGER_MS = 70;    // ms between each letter's jump

  // ── Per-letter config (D a t a i n o s a u r) ────────────────────────────
  // jumpV   : initial upward velocity (higher = taller jump)
  // rotAmp  : how much it tilts during the jump (negative = leans other way)
  // bounceMax: max floor hits before snapping home
  var CFG = [
    { jumpV:-16, rotAmp:-10, bounceMax:3 },  // D  — leans left, 3 bounces
    { jumpV:-22, rotAmp: 14, bounceMax:5 },  // a  — high and spinny
    { jumpV:-14, rotAmp: 18, bounceMax:5 },  // t  — tall letter does a big lean
    { jumpV:-19, rotAmp:-12, bounceMax:4 },  // a
    { jumpV:-26, rotAmp:  8, bounceMax:7 },  // i  — tiny & light, springs the most
    { jumpV:-17, rotAmp: 11, bounceMax:3 },  // n
    { jumpV:-20, rotAmp:-15, bounceMax:4 },  // o
    { jumpV:-23, rotAmp:-18, bounceMax:5 },  // s  — wild tilt
    { jumpV:-18, rotAmp: 10, bounceMax:4 },  // a
    { jumpV:-15, rotAmp: -9, bounceMax:3 },  // u  — heavier, fewer bounces
    { jumpV:-21, rotAmp: 16, bounceMax:5 },  // r
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

      particles.push({
        el  : el,
        cx  : cx,
        cy  : cy,
        y   : 0,
        vy  : 0,
        rot : 0,
        rotSpd     : 0,          // set on first jump
        settled    : false,
        jumped     : false,
        startAt    : START_MS + i * STAGGER_MS,
        bouncesDone: 0,
        cfg : c,
      });
    }

    var t0 = null;

    function snap(p) {
      p.settled = true;
      p.el.style.transition = 'transform 0.2s ease-out';
      p.el.setAttribute('transform', '');
      setTimeout(function () { p.el.style.transition = ''; }, 220);
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

        // First frame for this letter — give it the upward kick
        if (!p.jumped) {
          p.jumped = true;
          p.vy     = c.jumpV;                       // launch upward
          p.rotSpd = c.rotAmp * 0.18;               // start tilting on take-off
        }

        // Gravity
        p.vy += GRAVITY;
        p.y  += p.vy;

        // Tilt: lean into the direction of movement, decay each bounce
        var rotDecay = Math.max(1 - p.bouncesDone * 0.25, 0.1);
        if (p.vy < 0) {
          // going up — tilt forward
          p.rot += p.rotSpd * rotDecay;
        } else {
          // coming down — lean back
          p.rot -= p.rotSpd * 0.6 * rotDecay;
        }

        // Floor hit (y back to 0 = home position)
        if (p.y >= 0) {
          p.y   = 0;
          p.vy *= -DAMPING;
          p.bouncesDone++;

          if (Math.abs(p.vy) < SETTLE_V || p.bouncesDone >= c.bounceMax) {
            snap(p);
            continue;
          }
        }

        p.el.setAttribute(
          'transform',
          'translate(0 ' + p.y.toFixed(2) + ')' +
          ' rotate(' + p.rot.toFixed(2) + ' ' + p.cx.toFixed(2) + ' ' + p.cy.toFixed(2) + ')'
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
