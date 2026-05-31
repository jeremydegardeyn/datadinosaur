/* DataDinosaur — hero-animation.js
   0–2 s  : matrix rain builds up
   2 s    : dino HEAD rotates to face up (~-80°), jaw chomps 3×
             — dino-body (the D) stays completely fixed
             — dino-head group rotates, pivot at right-center (neck connection)
             — dino-lower-jaw rotates within head, pivot at right-center (jaw hinge)
   5.5 s  : tagline fades in
   10 s   : rain fades out
*/
'use strict';

(function () {
  var canvas   = document.getElementById('hero-matrix');
  var dinoHead = document.getElementById('dino-head');
  var dinoJaw  = document.getElementById('dino-lower-jaw');
  var tagline  = document.getElementById('hero-tagline');
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

  /* fade canvas in */
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
          if (t === 0) {
            ctx.fillStyle = 'rgba(210,255,210,1)';
          } else {
            a = ((TRAIL - t) / TRAIL) * 0.8;
            ctx.fillStyle = 'rgba(57,181,74,' + a + ')';
          }
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

  /* ── particle burst at chomp — spawns from snout/mouth area ── */
  function spawnBurst() {
    var jr = dinoJaw ? dinoJaw.getBoundingClientRect() : null;
    var cr = canvas.getBoundingClientRect();
    var mx, my;
    if (jr && isFinite(jr.left) && jr.width > 0) {
      mx = jr.left - cr.left + jr.width * 0.12;
      my = jr.top  - cr.top  + jr.height * 0.1;
    } else {
      mx = canvas.width  * 0.35;
      my = canvas.height * 0.05;
    }
    if (mx < 0 || mx > canvas.width)  mx = canvas.width  * 0.35;
    if (my < 0 || my > canvas.height) my = canvas.height * 0.05;

    var i, ang, spd;
    for (i = 0; i < 22; i++) {
      ang = (Math.random() - 0.5) * Math.PI * 0.85;
      spd = 2.5 + Math.random() * 5;
      particles.push({
        x:      mx + (Math.random() - 0.5) * 28,
        y:      my,
        vx:     Math.sin(ang) * spd,
        vy:    -Math.abs(Math.cos(ang)) * spd,
        char:   Math.random() < 0.5 ? '1' : '0',
        alpha:  1,
        size:   10 + Math.random() * 7,
        bright: Math.random() < 0.4,
      });
    }
  }

  /* ── transform setup ──
     Head pivot  : right-center of head fill-box ≈ neck connection point
     Jaw pivot   : right-center of jaw fill-box  ≈ jaw hinge at neck
     Both use CSS transform-box:fill-box so the pivot is relative
     to each element's own bounding box, not the SVG viewport.
  ── */
  dinoHead.style.transformBox    = 'fill-box';
  dinoHead.style.transformOrigin = 'right center';

  if (dinoJaw) {
    dinoJaw.style.transformBox    = 'fill-box';
    dinoJaw.style.transformOrigin = 'right center';
  }

  /* ── keyframes ──
     HEAD_KF : [p, headRot°]   — whole head rotates to look up
     JAW_KF  : [p, jawRot°]    — lower jaw, negative = opens (drops away from skull)
  ── */
  var HEAD_KF = [
    [0.00,   0],
    [0.20, -80],   /* tilt head up — snout aimed at rain  */
    [0.68, -80],   /* hold looking up                     */
    [1.00,   0],   /* return to rest                      */
  ];

  var JAW_KF = [
    [0.00,   0],
    [0.20,   0],   /* mouth closed while head tilts        */
    [0.23, -26],   /* jaw drops — mouth opens              */
    [0.27,   0],   /* CHOMP 1 — jaw snaps shut             */
    [0.30, -26],   /* open again                           */
    [0.37,   0],   /* CHOMP 2                              */
    [0.40, -26],   /* open again                           */
    [0.47,   0],   /* CHOMP 3                              */
    [0.51, -18],   /* rest open, still looking up          */
    [0.68, -18],
    [1.00,   0],   /* close as head returns to rest        */
  ];

  /* chomp peaks — fire particles when jaw snaps shut */
  var peaks = [0.27, 0.37, 0.47];
  var fired = [false, false, false];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function eio(t) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }

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

      var headRot = getKF(HEAD_KF, p);
      var jawRot  = getKF(JAW_KF, p);

      dinoHead.style.transform = 'rotate(' + headRot.toFixed(2) + 'deg)';
      if (dinoJaw) {
        dinoJaw.style.transform = 'rotate(' + jawRot.toFixed(2) + 'deg)';
      }

      for (var i = 0; i < peaks.length; i++) {
        if (!fired[i] && p >= peaks[i]) { fired[i] = true; spawnBurst(); }
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
