<div class="container admin-dashboard">
  <div class="admin-header">
    <h1>RAG</h1>
    <div class="admin-header-actions">
      <a href="/admin" class="btn btn-ghost">&larr; Dashboard</a>
    </div>
  </div>

  <div class="rag-tabs">
    <button class="rag-tab active" data-tab="eval" onclick="switchTab('eval', this)">Eval metrics</button>
    <button class="rag-tab" data-tab="feedback" onclick="switchTab('feedback', this)">User feedback</button>
  </div>

  <!-- ── Eval metrics tab ─────────────────────────────────────────────── -->
  <div id="tab-eval" class="rag-panel">
    <div class="rag-panel-actions">
      <button class="btn btn-primary" id="run-eval" onclick="runEval(this)">Run evaluation</button>
    </div>
    <p class="rag-panel-desc">
      Runs the gold question set (<code>rag/eval_dataset.json</code>) against live retrieval — no answer generation.
      Positive cases should rank the expected post highly (Hit@1 / @3 / @k, MRR).
      Negative cases should find no strongly-relevant chunk (out-of-scope).
    </p>
    <div id="eval-output"></div>
  </div>

  <!-- ── User feedback tab ────────────────────────────────────────────── -->
  <div id="tab-feedback" class="rag-panel" style="display:none">
    <div class="rag-panel-actions">
      <button class="btn btn-primary" id="load-feedback" onclick="loadFeedback(this)">Refresh</button>
    </div>
    <p class="rag-panel-desc">
      Answers visitors marked with a thumbs-down in the chat widget, newest first.
      Each one is a triage signal: bad grounding (fix the source), a stale index (re-index),
      or a true retrieval miss (tune ranking).
    </p>
    <div id="feedback-output"></div>
  </div>
</div>

<style>
  .rag-tabs { display:flex; gap:.25rem; margin-bottom:1.25rem; border-bottom:1px solid var(--border); }
  .rag-tab {
    background:none; border:none; border-bottom:2px solid transparent;
    color:var(--text-muted); cursor:pointer; font-size:.95rem; font-weight:600;
    padding:.6rem 1rem; margin-bottom:-1px;
  }
  .rag-tab:hover { color:var(--text); }
  .rag-tab.active { color:var(--text); border-bottom-color:var(--accent, #6b7db3); }
  .rag-panel-actions { display:flex; justify-content:flex-end; margin-bottom:1rem; }
  .rag-panel-desc { color:var(--text-muted); margin-bottom:1.25rem; max-width:62ch; }
  .fb-answer { color:var(--text-muted); font-size:.85rem; line-height:1.5; }
  .fb-q { font-weight:600; }
</style>

<script>
function pct(x){ return x == null ? '—' : Math.round(x * 100) + '%'; }
function esc(s){ var d = document.createElement('div'); d.textContent = (s == null ? '' : s); return d.innerHTML; }
function card(num, label){
  return '<div class="stat-card"><span class="stat-num">' + num + '</span>' +
         '<span class="stat-label">' + label + '</span></div>';
}

// ── Tabs ──────────────────────────────────────────────────────────────────
var feedbackLoaded = false;
function switchTab(name, btn){
  document.querySelectorAll('.rag-tab').forEach(function(t){ t.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('tab-eval').style.display     = (name === 'eval')     ? '' : 'none';
  document.getElementById('tab-feedback').style.display = (name === 'feedback') ? '' : 'none';
  if (name === 'feedback' && !feedbackLoaded) {
    loadFeedback(document.getElementById('load-feedback'));
  }
}

// ── Eval ──────────────────────────────────────────────────────────────────
function render(d){
  var s = d.summary;
  var h = '<div class="stats-grid">';
  h += card(pct(s.hit1_pct), 'Hit@1');
  h += card(pct(s.hit3_pct), 'Hit@3');
  h += card(pct(s.hitk_pct), 'Hit@' + s.top_k);
  h += card(s.mrr == null ? '—' : s.mrr.toFixed(3), 'MRR');
  h += card(pct(s.neg_pct), 'Out-of-scope');
  h += card(s.mean_top == null ? '—' : s.mean_top.toFixed(3), 'Mean top score');
  h += '</div>';
  h += '<section class="admin-section"><h2>Cases ' +
       '<span style="font-weight:400;color:var(--text-muted);font-size:.85rem">(' +
       s.positives + ' positive, ' + s.negatives + ' negative)</span></h2>' +
       '<table class="admin-table"><thead><tr><th></th><th>Question</th><th>Type</th>' +
       '<th>Expected</th><th>Top match</th><th>Score</th><th>Rank</th></tr></thead><tbody>';
  d.cases.forEach(function(c){
    h += '<tr><td>' + (c.pass ? '✅' : '❌') + '</td>' +
         '<td>' + esc(c.question) + '</td>' +
         '<td>' + esc(c.type) + '</td>' +
         '<td>' + esc((c.expect || []).join(', ') || '—') + '</td>' +
         '<td>' + esc(c.top_slug || '—') + '</td>' +
         '<td>' + c.top_score + '</td>' +
         '<td>' + (c.rank == null ? '—' : c.rank) + '</td></tr>';
  });
  h += '</tbody></table></section>';
  return h;
}
async function runEval(btn){
  var out  = document.getElementById('eval-output');
  var orig = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Running…';
  out.innerHTML = '';
  try {
    var res = await fetch('/api/rag/eval', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    var d = await res.json();
    if (!res.ok || !d.ok) {
      out.innerHTML = '<p class="alert alert-error">' + esc(d.error || 'Eval failed') + '</p>';
    } else {
      out.innerHTML = render(d);
    }
  } catch (e) {
    out.innerHTML = '<p class="alert alert-error">Network error</p>';
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────
function fmtDate(iso){
  if (!iso) return '—';
  var d = new Date(iso);
  return isNaN(d) ? esc(iso) : d.toLocaleString();
}
function renderFeedback(d){
  var h = '<div class="stats-grid">';
  h += card(d.down, 'Thumbs down');
  h += card(d.up,   'Thumbs up');
  h += '</div>';

  if (!d.items.length) {
    return h + '<p class="rag-panel-desc">No thumbs-down feedback yet. 🎉</p>';
  }

  h += '<section class="admin-section"><h2>Flagged answers ' +
       '<span style="font-weight:400;color:var(--text-muted);font-size:.85rem">(' +
       d.items.length + ')</span></h2>' +
       '<table class="admin-table"><thead><tr><th>When</th><th>Question &amp; answer</th>' +
       '<th>Sources</th><th>Top score</th></tr></thead><tbody>';
  d.items.forEach(function(it){
    var srcs = (it.sources || []).map(function(s){
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
             esc(s.title) + '</a>';
    }).join('<br>') || '—';
    h += '<tr>' +
         '<td style="white-space:nowrap">' + fmtDate(it.feedback_at) + '</td>' +
         '<td><div class="fb-q">' + esc(it.question) + '</div>' +
              '<div class="fb-answer">' + esc(it.answer) + '</div></td>' +
         '<td>' + srcs + '</td>' +
         '<td>' + (it.top_score == null ? '—' : it.top_score) + '</td>' +
         '</tr>';
  });
  h += '</tbody></table></section>';
  return h;
}
async function loadFeedback(btn){
  var out  = document.getElementById('feedback-output');
  var orig = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Loading…';
  out.innerHTML = '';
  try {
    var res = await fetch('/api/rag/feedback_list', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    var d = await res.json();
    if (!res.ok || !d.ok) {
      out.innerHTML = '<p class="alert alert-error">' + esc(d.error || 'Failed to load feedback') + '</p>';
    } else {
      feedbackLoaded = true;
      out.innerHTML = renderFeedback(d);
    }
  } catch (e) {
    out.innerHTML = '<p class="alert alert-error">Network error</p>';
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}
</script>
