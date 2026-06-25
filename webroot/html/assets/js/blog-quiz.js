/* DataDinosaur — blog-quiz.js
   Drives the :::quiz blocks emitted by dd_build_quiz(): single-answer
   multiple choice with immediate per-question feedback. Clicking an option
   locks that question, marks right/wrong, reveals the optional explanation,
   and updates a running score. No network calls — the answer key ships in the
   markup, which is fine for a low-stakes blog quiz. */
'use strict';

(function () {
  function initQuiz(el) {
    var questions = [].slice.call(el.querySelectorAll('.dd-quiz-q'));
    var scoreEl   = el.querySelector('.dd-quiz-score');
    var total     = questions.length;
    var answered  = 0;
    var correct   = 0;

    function updateScore() {
      if (!scoreEl) return;
      scoreEl.textContent = answered ? (correct + ' / ' + total + ' correct') : '';
      if (answered === total) el.classList.add('dd-quiz-complete');
    }

    questions.forEach(function (q) {
      var right   = parseInt(q.getAttribute('data-correct'), 10);
      var opts    = [].slice.call(q.querySelectorAll('.dd-quiz-opt'));
      var explain = q.querySelector('.dd-quiz-explain');
      var done    = false;

      opts.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (done) return;
          done = true;

          var chosen = parseInt(btn.getAttribute('data-i'), 10);
          var ok     = chosen === right;

          q.classList.add('answered');
          btn.classList.add(ok ? 'correct' : 'incorrect');
          if (!ok && opts[right]) opts[right].classList.add('correct');
          opts.forEach(function (b) { b.disabled = true; });
          if (explain) explain.hidden = false;

          answered++;
          if (ok) correct++;
          updateScore();
        });
      });
    });

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
