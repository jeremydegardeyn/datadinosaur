/* DataDinosaur — hero-animation.js
   0–2 s  : matrix rain builds up
   2 s    : dino rotates to face up (~-80°), then chomps 3×
             — scaleX along rotated local axis = vertical jaw-slam
             — particle burst of 1s/0s on each chomp close
   5.5 s  : tagline fades in
   10 s   : rain fades out
*/
'use strict';

(function () {
  var canvas  = document.getElementById('hero-matrix');
  var dinoGrp = document.getElementById('hero-dino-graphic');
  var tagline = document.getElementById('hero-tagline');
  if (!canvas || !dinoGrp) return;

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

    /* rain */
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

    /* particles */
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

  /* ── particle burst at chomp ── */
  function spawnBurst() {
    var dr = dinoGrp.getBoundingClientRect();
    var cr = canvas.getBoundingClientRect();
    var mx = (dr.left + dr.right) / 2 - cr.left;
    var my = dr.top - cr.top + 4;
    /* fallback if rect is degenerate */
    if (!isFinite(mx) || mx < 0 || mx > canvas.width) mx = canvas.width * 0.42;
    if (!isFinite(my) || my < 0)                       my = canvas.height * 0.08;

    var i, ang, spd;
    for (i = 0; i < 22; i++) {
      ang = (Math.random() - 0.5) * Math.PI * 0.85; /* horizontal spread */
      spd = 2.5 + Math.random() * 5;
      particles.push({
        x:      mx + (Math.random() - 0.5) * 28,
        y:      my,
        vx:     Math.sin(ang) * spd,
        vy:    -Math.abs(Math.cos(ang)) * spd, /* always upward */
        char:   Math.random() < 0.5 ? '1' : '0',
        alpha:  1,
        size:   10 + Math.random() * 7,
        bright: Math.random() < 0.4,
      });
    }
  }

  /* ── dino keyframe animation ──
     Transform order:  rotate(rot) scaleX(s)
     CSS applies left→right, each in the new local space, so:
       1. rotate(rot)  — tilts the dino, rotates local axes
       2. scaleX(s)    — compresses along the NOW-ROTATED local X
     At rot=-80° the local X axis points ~upward in screen space,
     so scaleX(0.18) slams the shape vertically = jaw snap. ✓
  ── */
  dinoGrp.style.transformBox    = 'fill-box';
  dinoGrp.style.transformOrigin = 'center center';

  /*  p=0..1  rot(°)  scaleX */
  var KF = [
    [0.00,    0,  1.00],
    [0.20,  -80,  1.00],  /* tilt to face up — mouth aimed at rain  */
    [0.26,  -80,  0.16],  /* CHOMP 1 — jaws slam                    */
    [0.33,  -80,  1.10],  /* spring open                            */
    [0.39,  -80,  0.16],  /* CHOMP 2                                */
    [0.46,  -80,  1.10],  /* spring open                            */
    [0.52,  -80,  0.16],  /* CHOMP 3                                */
    [0.59,  -80,  1.05],  /* spring open                            */
    [0.70,  -80,  1.00],  /* pause — looking up, mouth open         */
    [1.00,    0,  1.00],  /* return to rest                         */
  ];

  /* chomp peaks (p values where scaleX hits minimum → fire particles) */
  var peaks  = [0.26, 0.39, 0.52];
  var fired  = [false, false, false];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function eio(t) { return t < 0.5 ? 2*t*t : -1 + (4-2*t)*t; }

  function getXF(p) {
    var i, span, t;
    for (i = 1; i < KF.length; i++) {
      if (p <= KF[i][0]) {
        span = KF[i][0] - KF[i-1][0];
        t    = span > 0 ? eio((p - KF[i-1][0]) / span) : 1;
        return { rot: lerp(KF[i-1][1], KF[i][1], t),
                 sx:  lerp(KF[i-1][2], KF[i][2], t) };
      }
    }
    return { rot: 0, sx: 1 };
  }

  setTimeout(function () {
    var start = null, DUR = 3600;

    function step(ts) {
      if (!start) start = ts;
      var p  = Math.min((ts - start) / DUR, 1);
      var xf = getXF(p);

      dinoGrp.style.transform =
        'rotate(' + xf.rot.toFixed(2) + 'deg) scaleX(' + xf.sx.toFixed(3) + ')';

      /* fire particle burst at each chomp peak */
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
