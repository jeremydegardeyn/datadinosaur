<div class="container admin-dashboard">
  <div class="admin-header">
    <h1>RAG Retrieval Eval</h1>
    <div class="admin-header-actions">
      <a href="/admin" class="btn btn-ghost">&larr; Dashboard</a>
      <button class="btn btn-primary" id="run-eval" onclick="runEval(this)">Run evaluation</button>
    </div>
  </div>

  <p style="color:var(--text-muted);margin-bottom:1.25rem;max-width:60ch">
    Runs the gold question set (<code>rag/eval_dataset.json</code>) against live retrieval — no answer generation.
    Positive cases should rank the expected post highly (Hit@1 / @3 / @k, MRR).
    Negative cases should find no strongly-relevant chunk (out-of-scope).
  </p>

  <div id="eval-output"></div>
</div>

<script>
function pct(x){ return x == null ? '—' : Math.round(x * 100) + '%'; }
function esc(s){ var d = document.createElement('div'); d.textContent = (s == null ? '' : s); return d.innerHTML; }
function card(num, label){
  return '<div class="stat-card"><span class="stat-num">' + num + '</span>' +
         '<span class="stat-label">' + label + '</span></div>';
}
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
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
</script>
