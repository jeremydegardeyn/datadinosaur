/* DataDinosaur — blog-slideshow.js
   Drives the :::slideshow carousels emitted by enhance_post_images():
   prev/next arrows, clickable dots, a slide counter, plus arrow-key (when the
   slideshow is focused) and touch-swipe navigation. No autoplay. */
'use strict';

(function () {
  function initSlideshow(el) {
    var slides = [].slice.call(el.querySelectorAll('.dd-slide'));
    var dots   = [].slice.call(el.querySelectorAll('.dd-slide-dot'));
    var cur    = el.querySelector('.dd-slide-cur');
    var n = slides.length;
    var i = 0;

    // A single image needs no controls.
    if (n < 2) {
      [].forEach.call(el.querySelectorAll('.dd-slide-nav,.dd-slide-dots,.dd-slide-count'),
        function (c) { c.style.display = 'none'; });
      return;
    }

    function show(k) {
      i = (k + n) % n;
      slides.forEach(function (s, idx) { s.classList.toggle('active', idx === i); });
      dots.forEach(function (d, idx) { d.classList.toggle('active', idx === i); });
      if (cur) cur.textContent = i + 1;
    }

    el.querySelector('.dd-slide-prev').addEventListener('click', function () { show(i - 1); });
    el.querySelector('.dd-slide-next').addEventListener('click', function () { show(i + 1); });
    dots.forEach(function (d, idx) { d.addEventListener('click', function () { show(idx); }); });

    // Arrow keys when the slideshow is focused.
    el.tabIndex = 0;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { show(i - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
    });

    // Touch swipe.
    var x0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1);
    });
  }

  function init() {
    [].forEach.call(document.querySelectorAll('.dd-slideshow'), initSlideshow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
