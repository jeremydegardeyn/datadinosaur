/* Single-post enhancements: reading progress, copy link, code highlighting
   and copy buttons, and the syntax theme following the site theme. */
(function () {
  'use strict';

  // ---- Reading progress bar ----
  var bar = document.getElementById('readProgress');
  var body = document.querySelector('.post-body');
  if (bar && body) {
    var ticking = false;
    var update = function () {
      var r = body.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var done = Math.min(1, Math.max(0, -r.top / (total > 0 ? total : 1)));
      bar.style.transform = 'scaleX(' + done + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ---- Copy link ----
  document.querySelectorAll('[data-copy-link]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var label = btn.querySelector('span');
      var done = function () {
        if (!label) return;
        var old = label.textContent;
        label.textContent = 'Copied';
        setTimeout(function () { label.textContent = old; }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.copyLink).then(done, done);
    });
  });

  // ---- Code blocks: copy button + language label ----
  document.querySelectorAll('.prose pre > code').forEach(function (code) {
    var pre = code.parentElement;
    var wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    var lang = (code.className.match(/language-([\w+-]+)/) || [])[1];
    if (lang && lang !== 'text') {
      var tag = document.createElement('span');
      tag.className = 'code-lang';
      tag.textContent = lang;
      wrap.appendChild(tag);
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.addEventListener('click', function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(code.innerText).then(function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
      });
    });
    wrap.appendChild(btn);
  });

  // ---- Syntax highlighting (highlight.js loads deferred from cdnjs) ----
  var syncHljsTheme = function () {
    var dark = document.getElementById('hljsDark');
    var light = document.getElementById('hljsLight');
    if (!dark || !light) return;
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light')      { dark.media = 'not all'; light.media = 'all'; }
    else if (t === 'dark')  { dark.media = 'all';     light.media = 'not all'; }
    else { dark.media = '(prefers-color-scheme: dark)'; light.media = '(prefers-color-scheme: light)'; }
  };
  syncHljsTheme();
  document.addEventListener('dd:themechange', syncHljsTheme);

  var highlight = function () {
    if (!window.hljs) return;
    document.querySelectorAll('.prose pre > code').forEach(function (el) {
      if (/language-(text|plaintext)\b/.test(el.className)) return;
      try { window.hljs.highlightElement(el); } catch (e) { /* unknown language: leave plain */ }
    });
  };
  if (window.hljs) highlight();
  else window.addEventListener('load', highlight);
})();
