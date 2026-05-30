/* DataDinosaur — hero-animation.js
   0 s  : Matrix rain spins up (transparent bg, top/bottom fade via CSS mask)
   2 s  : Dinosaur looks up, swings around, chomps twice (JS rAF driven)
   5 s  : "Taking Bytes Out of Big Data" fades in
   9 s  : Rain fades out
*/
'use strict';

(function () {
  var canvas  = document.getElementById('hero-matrix');
  var dinoGrp = document.getElementById('hero-dino-graphic');
  var tagline = document.getElementById('hero-tagline');

  if (!canvas || !dinoGrp) return;

  /* ===================== MATRIX RAIN ===================== */

  var ctx    = canvas.getContext('2d');
  var FS     = 13;   // px per column / font size
  var TRAIL  = 10;   // trailing character count
  var drops  = [];
  var active = true;
  var raf;

  function resize() {
    var wrap = canvas.parentElement;
    canvas.width  = wrap.offsetWidth  || 420;
    canvas.height = wrap.offsetHeight || 200;
    drops = initDrops();
  }

  function initDrops() {
    var cols = Math.ceil(canvas.width / FS);
    var arr  = [];
    for (var i = 0; i < cols; i++) {
      arr.push({
        y:     -(Math.random() * canvas.height * 2),  // staggered start
        speed: 0.5 + Math.random() * 1.0,
      });
    }
    return arr;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Fade canvas in over 1.5 s
  canvas.style.opacity    = '0';
  canvas.style.transition = 'opacity 1.5s ease';
  setTimeout(function () { canvas.style.opacity = '1'; }, 100);

  function rainFrame() {
    if (!active) return;
    raf = requestAnimationFrame(rainFrame);

    // Transparent background — clearRect so the hero dark bg shows through
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FS + 'px monospace';

    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];

      for (var t = TRAIL; t >= 0; t--) {
        var cy = d.y - t * FS;
        if (cy < -FS || cy > canvas.height + FS) continue;

        var alpha;
        if (t === 0) {
          // Head character — bright near-white green
          ctx.fillStyle = 'rgba(210,255,210,1.0)';
        } else {
          // Tail — brand green fading with distance
          alpha = ((TRAIL - t) / TRAIL) * 0.8;
          ctx.fillStyle = 'rgba(57,181,74,' + alpha + ')';
        }
        ctx.fillText(Math.random() < 0.5 ? '1' : '0', i * FS, cy);
      }

      d.y += d.speed;

      // Reset column after it clears the bottom
      if (d.y > canvas.height + TRAIL * FS && Math.random() > 0.965) {
        d.y     = -(FS * (2 + Math.floor(Math.random() * 20)));
        d.speed = 0.5 + Math.random() * 1.0;
      }
    }
  }

  raf = requestAnimationFrame(rainFrame);

  /* ===================== DINO ANIMATION =====================
     Keyframe table: [progress 0-1, rotation deg, scaleX]
     Driven by rAF + JS so transform-box/origin are set reliably
     regardless of SVG/CSS quirks.
  ============================================================ */

  // Set transform origin near the base of the D-shape
  dinoGrp.style.transformBox    = 'fill-box';
  dinoGrp.style.transformOrigin = 'center bottom';

  var KF = [
    /* p      rot   scaleX */
    [0.00,    0,    1.00],
    [0.12,  -22,    1.00],  // look up
    [0.26,    9,    1.00],  // swing right / look around
    [0.37,  -14,    1.00],  // pull back to bite position
    [0.44,  -14,    0.55],  // CHOMP 1 — D mouth snaps shut
    [0.51,  -14,    1.08],  // rebound open
    [0.58,  -14,    0.55],  // CHOMP 2
    [0.67,  -14,    1.00],  // rebound open
    [0.82,    3,    1.00],  // swing back right
    [1.00,    0,    1.00],  // settle at rest
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }

  // Per-segment ease-in-out
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function getDinoXF(p) {
    for (var i = 1; i < KF.length; i++) {
      if (p <= KF[i][0]) {
        var span = KF[i][0] - KF[i - 1][0];
        var t    = easeInOut((p - KF[i - 1][0]) / span);
        return {
          rot:    lerp(KF[i - 1][1], KF[i][1], t),
          scaleX: lerp(KF[i - 1][2], KF[i][2], t),
        };
      }
    }
    return { rot: 0, scaleX: 1 };
  }

  setTimeout(function () {
    var start    = null;
    var DURATION = 3000;

    function animDino(ts) {
      if (!start) start = ts;
      var p  = Math.min((ts - start) / DURATION, 1);
      var xf = getDinoXF(p);
      dinoGrp.style.transform =
        'rotate(' + xf.rot.toFixed(2) + 'deg) scaleX(' + xf.scaleX.toFixed(3) + ')';
      if (p < 1) requestAnimationFrame(animDino);
    }

    requestAnimationFrame(animDino);
  }, 2000);

  /* ===================== TAGLINE ===================== */

  setTimeout(function () {
    if (tagline) tagline.classList.add('visible');
  }, 5000);

  /* ===================== FADE OUT RAIN ===================== */

  setTimeout(function () {
    active = false;
    cancelAnimationFrame(raf);
    canvas.style.transition = 'opacity 3s ease';
    canvas.style.opacity    = '0';
  }, 9000);

})();
