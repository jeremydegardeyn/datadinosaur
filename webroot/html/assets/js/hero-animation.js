/* DataDinosaur — hero-animation.js
   Matrix rain builds up, fades out smoothly after tagline appears.
   Dino logo is fully static.
*/
'use strict';

(function () {
  var canvas  = document.getElementById('hero-matrix');
  var tagline = document.getElementById('hero-tagline');
  if (!canvas) return;

  var ctx   = canvas.getContext('2d');
  var FS    = 13;
  var TRAIL = 10;
  var drops = [];
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
      /* start drops well above the canvas so rain is already falling on load */
      arr.push({ y: -(Math.random() * canvas.height * 3),
                 speed: 0.5 + Math.random() });
    return arr;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* fade canvas in */
  canvas.style.opacity    = '0';
  canvas.style.transition = 'opacity 1s ease';
  setTimeout(function () { canvas.style.opacity = '0.55'; }, 50);

  /* ── draw loop — runs until canvas is fully invisible ── */
  function draw() {
    raf = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FS + 'px monospace';

    var i, t, d, cy;
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
  raf = requestAnimationFrame(draw);

  /* tagline */
  setTimeout(function () {
    if (tagline) tagline.classList.add('visible');
  }, 3000);

  /* fade rain out gradually — RAF keeps running so animation doesn't freeze */
  setTimeout(function () {
    canvas.style.transition = 'opacity 4s ease';
    canvas.style.opacity    = '0';
  }, 3500);

})();
