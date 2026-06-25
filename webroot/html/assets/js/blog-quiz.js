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

    function showResults(dist, count) {
      if (youEl) youEl.textContent = 'You scored ' + correct + ' / ' + total + '.';
      if (histEl) {
        if (dist) { buildHistogram(histEl, dist, correct); histEl.hidden = false; }
        else histEl.hidden = true;
      }
      if (capEl) {
        capEl.textContent = count
          ? 'Where you landed among ' + count + ' ' + (count === 1 ? 'attempt' : 'attempts') + '.'
          : '';
      }
      if (results) results.hidden = false;
    }

    function finish() {
      el.classList.add('dd-quiz-complete');
      if (!quizId || !window.fetch) { showResults(null, 0); return; }
      fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId, score: correct, total: total })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) { showResults(d && d.dist, d && d.count); })
        .catch(function () { showResults(null, 0); });
    }

    function wire(q) {
      var right = parseInt(q.getAttribute('data-correct'), 10);
      var opts  = [].slice.call(q.querySelectorAll('.dd-quiz-opt'));
      q._answered = false;
      opts.forEach(function (btn) {
        btn.onclick = function () {
          if (q._answered) return;
          q._answered = true;
          var chosen = parseInt(btn.getAttribute('data-i'), 10);
          var ok = chosen === right;
          q.classList.add('answered');
          btn.classList.add(ok ? 'correct' : 'incorrect');
          if (!ok && opts[right]) opts[right].classList.add('correct');
          opts.forEach(function (b) { b.disabled = true; });

          // Reveal the picked option's note; if wrong, also the correct one's.
          var chosenExp = q.querySelector('.dd-quiz-opt-explain[data-for="' + chosen + '"]');
          if (chosenExp) { chosenExp.classList.add(ok ? 'is-correct' : 'is-wrong'); chosenExp.hidden = false; }
          if (!ok) {
            var correctExp = q.querySelector('.dd-quiz-opt-explain[data-for="' + right + '"]');
            if (correctExp) { correctExp.classList.add('is-correct'); correctExp.hidden = false; }
          }
          var general = q.querySelector('.dd-quiz-explain');
          if (general) general.hidden = false;

          answered++;
          if (ok) correct++;
          updateScore();
          if (answered === total) finish();
        };
      });
    }

    function reset() {
      answered = 0;
      correct  = 0;
      el.classList.remove('dd-quiz-complete');
      if (results) results.hidden = true;
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
