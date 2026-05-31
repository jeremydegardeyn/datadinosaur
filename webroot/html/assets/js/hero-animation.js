/* DataDinosaur — hero-animation.js
   0–2 s  : matrix rain builds up
   2 s    : dino head rotates ~-90° counterclockwise (snout swings DOWN toward the
             last "a" in Data), jaw opens then chomps 2×, bite mark appears on "a",
             head returns to rest
   5.5 s  : tagline fades in
   10 s   : rain fades out

   Pivot geometry (fill-box, right center):
     dino-head pivot  ≈ (314.8, 256)  — neck connection to D body
     dino-lower-jaw pivot ≈ right-center of jaw fill-box — jaw hinge

   Head rotation -90° swings the snout from upper-left to lower-left,
   putting the mouth directly over the "a". Positive jaw rotation opens
   the mandible (chin drops away from skull in the head's local frame).
*/
'use strict';

(function () {
  var canvas    = document.getElementById('hero-matrix');
  var dinoHead  = document.getElementById('dino-head');
  var dinoJaw   = document.getElementById('dino-lower-jaw');
  var dataA     = document.getElementById('data-a');
  var dataABit  = document.getElementById('data-a-bitten');
  var tagline   = document.getElementById('hero-tagline');
  if (!canvas || !dinoHead) return;

  var ctx       = canvas.getContext('2d');
  var FS        = 13;
  var TRAIL     = 10;
  var drops     = [];
  var particles = [];
  var rainOn    = true;
  var raf;

  /* ── canvas sizing ── */
  function resize() {
    var wrap = canvas.parentElement;
    canvas.width  = wrap.offsetWidth  || 420;
    canvas.height = wrap.offsetHeight || 200;
    drops = initDrops();
  }
  function initDrops() {
    var n = Math.ceil(canvas.width / FS), arr = [], i;
    for (i = 0; i < n; i++)
      arr.push({ y: -Math.random() * canvas.height * 2,
                 speed: 0.5 + Math.random() });
    return arr;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  canvas.style.opacity    = '0';
  canvas.style.transition = 'opacity 1.5s ease';
  setTimeout(function () { canvas.style.opacity = '1'; }, 100);

  /* ── main draw loop ── */
  function draw() {
    raf = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FS + 'px monospace';

    if (rainOn) {
      var i, t, d, cy, a;
      for (i = 0; i < drops.length; i++) {
        d = drops[i];
        for (t = TRAIL; t >= 0; t--) {
          cy = d.y - t * FS;
          if (cy < -FS || cy > canvas.height + FS) continue;
          ctx.fillStyle = t === 0
            ? 'rgba(210,255,210,1)'
            : 'rgba(57,181,74,' + ((TRAIL - t) / TRAIL * 0.8) + ')';
          ctx.fillText(Math.random() < 0.5 ? '1' : '0', i * FS, cy);
        }
        d.y += d.speed;
        if (d.y > canvas.height + TRAIL * FS && Math.random() > 0.965) {
          d.y     = -(FS * (2 + Math.floor(Math.random() * 20)));
          d.speed = 0.5 + Math.random();
        }
      }
    }

    if (particles.length) {
      var j, p;
      ctx.save();
      for (j = particles.length - 1; j >= 0; j--) {
        p = particles[j];
        p.vy    += 0.18;
        p.vx    *= 0.97;
        p.x     += p.vx;
        p.y     += p.vy;
        p.alpha -= 0.024;
        if (p.alpha <= 0) { particles.splice(j, 1); continue; }
        ctx.globalAlpha = p.alpha;
        ctx.font        = p.size + 'px monospace';
        ctx.fillStyle   = p.bright ? '#d4ffd4' : '#39B54A';
        ctx.fillText(p.char, p.x, p.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (!rainOn && !particles.length) cancelAnimationFrame(raf);
  }
  raf = requestAnimationFrame(draw);

  /* ── particle burst — spawn near the bitten "a" ── */
  function spawnBurst() {
    var ar = dataA ? dataA.getBoundingClientRect() : null;
    var cr = canvas.getBoundingClientRect();
    var mx, my;
    if (ar && isFinite(ar.left) && ar.width > 0) {
      mx = ar.right  - cr.left - ar.width  * 0.35;
      my = ar.top    - cr.top  + ar.height * 0.15;
    } else {
      mx = canvas.width  * 0.28;
      my = canvas.height * 0.80;
    }

    var i, ang, spd;
    for (i = 0; i < 22; i++) {
      ang = (Math.random() - 0.5) * Math.PI * 1.1;
      spd = 2 + Math.random() * 4.5;
      particles.push({
        x:      mx + (Math.random() - 0.5) * 24,
        y:      my,
        vx:     Math.sin(ang) * spd,
        vy:    -Math.abs(Math.cos(ang)) * spd,
        char:   Math.random() < 0.5 ? '1' : '0',
        alpha:  1,
        size:   9 + Math.random() * 7,
        bright: Math.random() < 0.4,
      });
    }
  }

  /* ── reveal bite mark ── */
  function applyBite() {
    if (dataA)    dataA.style.display    = 'none';
    if (dataABit) dataABit.style.display = '';
  }

  /* ── transform setup ──
     Head pivot   : right-center of head fill-box (≈ neck junction)
     Jaw pivot    : right-center of jaw fill-box  (≈ jaw hinge)
     Negative head rotation = counterclockwise = snout sweeps DOWN toward "a".
     Positive jaw rotation  = mandible drops    = mouth opens.
  ── */
  dinoHead.style.transformBox    = 'fill-box';
  dinoHead.style.transformOrigin = 'right center';

  if (dinoJaw) {
    dinoJaw.style.transformBox    = 'fill-box';
    dinoJaw.style.transformOrigin = 'right center';
  }

  /* ── keyframes: [progress 0–1, value] ──
     HEAD_KF : head rotation in degrees  (negative = CCW = snout down)
     JAW_KF  : jaw rotation in degrees   (positive = mouth open)
  ── */
  var HEAD_KF = [
    [0.00,   0],
    [0.28, -90],   /* sweep snout down to the "a"          */
    [0.62, -90],   /* hold while chomping                  */
    [1.00,   0],   /* lift back to rest                    */
  ];

  var JAW_KF = [
    [0.00,   0],
    [0.25,   0],   /* mouth closed during descent          */
    [0.32,  38],   /* jaw drops wide open                  */
    [0.40,   0],   /* CHOMP 1 — jaw snaps shut             */
    [0.46,  32],   /* open again                           */
    [0.54,   0],   /* CHOMP 2                              */
    [0.60,  16],   /* rest slightly open                   */
    [0.70,  16],
    [1.00,   0],   /* close as head lifts                  */
  ];

  /* fire at each jaw-close peak */
  var peaks  = [0.40, 0.54];
  var fired  = [false, false];
  var bitten = false;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function eio(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function getKF(kf, p) {
    var i, span, t;
    for (i = 1; i < kf.length; i++) {
      if (p <= kf[i][0]) {
        span = kf[i][0] - kf[i-1][0];
        t    = span > 0 ? eio((p - kf[i-1][0]) / span) : 1;
        return lerp(kf[i-1][1], kf[i][1], t);
      }
    }
    return kf[kf.length - 1][1];
  }

  setTimeout(function () {
    var start = null, DUR = 3600;

    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / DUR, 1);

      dinoHead.style.transform = 'rotate(' + getKF(HEAD_KF, p).toFixed(2) + 'deg)';
      if (dinoJaw) {
        dinoJaw.style.transform = 'rotate(' + getKF(JAW_KF, p).toFixed(2) + 'deg)';
      }

      for (var i = 0; i < peaks.length; i++) {
        if (!fired[i] && p >= peaks[i]) {
          fired[i] = true;
          spawnBurst();
          if (!bitten) { bitten = true; applyBite(); }
        }
      }

      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, 2000);

  /* tagline */
  setTimeout(function () {
    if (tagline) tagline.classList.add('visible');
  }, 5500);

  /* fade rain out */
  setTimeout(function () {
    rainOn = false;
    canvas.style.transition = 'opacity 3s ease';
    canvas.style.opacity    = '0';
  }, 10000);

})();
