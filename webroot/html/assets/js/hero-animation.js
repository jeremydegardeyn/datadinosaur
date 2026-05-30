/* DataDinosaur — hero-animation.js
   Sequence:
   0-2s   : Matrix rain spins up
   2-5s   : Dinosaur looks up, swings around, chomps twice
   5s+    : "Taking Bytes Out of Big Data" fades in
   9s     : Rain fades out
*/
'use strict';

(function () {
  var canvas  = document.getElementById('hero-matrix');
  var dinoGrp = document.getElementById('hero-dino-graphic');
  var tagline = document.getElementById('hero-tagline');

  if (!canvas || !dinoGrp) return;

  var ctx  = canvas.getContext('2d');
  var FS   = 13;   // column width / font size px
  var drops = [];
  var raf;
  var active = true;

  // ---- Size canvas to fill the wrap ----
  function resize() {
    var wrap = canvas.parentElement;
    canvas.width  = wrap.offsetWidth  || 420;
    canvas.height = wrap.offsetHeight || 160;
    drops = initDrops();
  }

  function initDrops() {
    var cols = Math.ceil(canvas.width / FS);
    var arr  = [];
    for (var i = 0; i < cols; i++) {
      arr.push({
        y:     -Math.random() * canvas.height * 1.8, // staggered start
        speed: 0.55 + Math.random() * 0.9,
      });
    }
    return arr;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Fade matrix in gradually over first 1.5 s
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 1.5s ease';
  setTimeout(function () { canvas.style.opacity = '0.42'; }, 80);

  // ---- Main animation loop ----
  function frame() {
    if (!active) return;
    raf = requestAnimationFrame(frame);

    // Semi-transparent overlay creates the trailing fade effect
    ctx.fillStyle = 'rgba(15,17,23,0.13)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = FS + 'px monospace';

    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];

      // Head char — bright lead green
      ctx.fillStyle = '#6fef82';
      ctx.fillText(Math.random() < 0.5 ? '1' : '0', i * FS, d.y);

      // Previous char one step back — mid green for depth
      if (d.y > FS) {
        ctx.fillStyle = '#39B54A';
        ctx.fillText(Math.random() < 0.5 ? '1' : '0', i * FS, d.y - FS);
      }

      d.y += d.speed;

      // Reset column when it leaves the canvas, with a random pause
      if (d.y > canvas.height + FS && Math.random() > 0.965) {
        d.y     = -(FS * (3 + Math.floor(Math.random() * 18)));
        d.speed = 0.55 + Math.random() * 0.9;
      }
    }
  }

  raf = requestAnimationFrame(frame);

  // ---- 2 s: trigger dino animation ----
  setTimeout(function () {
    dinoGrp.classList.add('dino-chomping');
  }, 2000);

  // ---- 5 s: fade in tagline ----
  setTimeout(function () {
    if (tagline) tagline.classList.add('visible');
  }, 5000);

  // ---- 9 s: fade out matrix rain ----
  setTimeout(function () {
    active = false;
    cancelAnimationFrame(raf);
    canvas.style.transition = 'opacity 3s ease';
    canvas.style.opacity = '0';
  }, 9000);

})();
