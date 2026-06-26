/* DataDinosaur — blog-quiz.js
   Drives the :::quiz blocks emitted by dd_build_quiz(): single-answer
   multiple choice with immediate per-question feedback. When every question
   is answered it posts the score to /api/quiz, then shows an anonymous score
   histogram (the reader's bucket highlighted) plus a Retake button. The
   answer key ships in the markup, which is fine for a low-stakes blog quiz. */
'use strict';

(function () {
  function buildHistogram(host, dist, userScore) {
    var max = Math.max.apply(null, dist.concat([1]));
    host.innerHTML = '';
    dist.forEach(function (c, s) {
      var col = document.createElement('div');
      col.className = 'dd-quiz-col' + (s === userScore ? ' you' : '');

      if (s === userScore) {
        var tag = document.createElement('span');
        tag.className = 'dd-quiz-youtag';
        tag.textContent = 'You';
        col.appendChild(tag);
      }
      var bar = document.createElement('div');
      bar.className = 'dd-quiz-bar';
      bar.style.height = Math.round((c / max) * 100) + '%';
      bar.title = c + (c === 1 ? ' person' : ' people') + ' scored ' + s;
      col.appendChild(bar);

      var lbl = document.createElement('span');
      lbl.className = 'dd-quiz-collabel';
      lbl.textContent = s;
      col.appendChild(lbl);

      host.appendChild(col);
    });
  }

  function initQuiz(el) {
    var quizId    = el.getAttribute('data-quiz-id');
    var total     = parseInt(el.getAttribute('data-count'), 10);
    var questions = [].slice.call(el.querySelectorAll('.dd-quiz-q'));
    var scoreEl   = el.querySelector('.dd-quiz-score');
    var results   = el.querySelector('.dd-quiz-results');
    var histEl    = results && results.querySelector('.dd-quiz-hist');
    var youEl     = results && results.querySelector('.dd-quiz-youscored');
    var capEl     = results && results.querySelector('.dd-quiz-hist-cap');
    var retakeBtn = results && results.querySelector('.dd-quiz-retake');
    var answered  = 0;
    var correct   = 0;

    function updateScore() {
      if (scoreEl) scoreEl.textContent = answered ? (correct + ' / ' + total + ' correct') : '';
    }

    // Render the histogram. `mine` is the reader's score to highlight, or -1
    // while they're still working (just showing how everyone else has done).
    function renderHist(dist, count, mine) {
      if (!results || !histEl) return;
      buildHistogram(histEl, dist, (mine == null ? -1 : mine));
      if (capEl) {
        if (!count) capEl.textContent = 'Be the first to finish it.';
        else capEl.textContent = (mine != null ? 'Your score is highlighted — ' : '') +
          count + ' ' + (count === 1 ? 'attempt' : 'attempts') + ' so far.';
      }
      results.hidden = false;
    }

    // Read-only fetch of the current distribution, shown from page load.
    function loadDistribution() {
      if (!quizId || !window.fetch) return;
      fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId, total: total })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.dist) renderHist(d.dist, d.count, null); })
        .catch(function () {});
    }

    function finish() {
      el.classList.add('dd-quiz-complete');
      if (youEl) { youEl.textContent = 'You scored ' + correct + ' / ' + total + '.'; youEl.hidden = false; }
      if (retakeBtn) retakeBtn.hidden = false;
      if (!quizId || !window.fetch) return;
      fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId, score: correct, total: total })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.dist) renderHist(d.dist, d.count, correct); })
        .catch(function () {});
    }

    function wire(q) {
      var right = parseInt(q.getAttribute('data-correct'), 10);
      var opts  = [].slice.call(q.querySelectorAll('.dd-quiz-opt'));
      q._locked = false;   // true once answered correctly — no more changes
      q._scored = false;   // leaderboard score is taken from the FIRST attempt

      function clearMarks() {
        opts.forEach(function (b) { b.classList.remove('correct', 'incorrect'); });
        [].forEach.call(q.querySelectorAll('.dd-quiz-opt-explain'), function (p) {
          p.hidden = true; p.classList.remove('is-correct', 'is-wrong');
        });
      }

      opts.forEach(function (btn) {
        btn.onclick = function () {
          if (q._locked) return;
          var chosen = parseInt(btn.getAttribute('data-i'), 10);
          var ok = chosen === right;

          clearMarks();
          btn.classList.add(ok ? 'correct' : 'incorrect');

          // Reveal only the picked option's own explanation.
          var chosenExp = q.querySelector('.dd-quiz-opt-explain[data-for="' + chosen + '"]');
          if (chosenExp) { chosenExp.classList.add(ok ? 'is-correct' : 'is-wrong'); chosenExp.hidden = false; }
          var general = q.querySelector('.dd-quiz-explain');
          if (general) {
            general.classList.remove('is-correct', 'is-wrong');
            general.classList.add(ok ? 'is-correct' : 'is-wrong');
            general.hidden = false;
          }

          // Score the first attempt only; retries are for learning.
          if (!q._scored) {
            q._scored = true;
            q.classList.add('answered');
            answered++;
            if (ok) correct++;
            updateScore();
          }

          // Correct locks the question; a wrong pick leaves the other options
          // live so the reader can simply click a different one to try again.
          if (ok) {
            q._locked = true;
            opts.forEach(function (b) { b.disabled = true; });
          }

          if (answered === total) finish();
        };
      });
    }

    function reset() {
      answered = 0;
      correct  = 0;
      el.classList.remove('dd-quiz-complete');
      // Keep the distribution visible; just drop the "you scored" line, the
      // Retake button, and the highlight (reload the plain distribution).
      if (youEl) { youEl.textContent = ''; youEl.hidden = true; }
      if (retakeBtn) retakeBtn.hidden = true;
      loadDistribution();
      questions.forEach(function (q) {
        q.classList.remove('answered');
        [].forEach.call(q.querySelectorAll('.dd-quiz-explain, .dd-quiz-opt-explain'), function (p) {
          p.hidden = true;
          p.classList.remove('is-correct', 'is-wrong');
        });
        [].forEach.call(q.querySelectorAll('.dd-quiz-opt'), function (b) {
          b.disabled = false;
          b.classList.remove('correct', 'incorrect');
        });
        wire(q);
      });
      updateScore();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    questions.forEach(wire);
    if (retakeBtn) retakeBtn.onclick = reset;
    updateScore();
    loadDistribution();   // show the current distribution from page load
  }

  function init() {
    [].forEach.call(document.querySelectorAll('.dd-quiz'), initQuiz);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
