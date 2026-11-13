<?php
// Printable lead-magnet checklist, derived from the post
// "Is Your RAG Pipeline Actually Secure? A 10-Question Gut Check".
$items = [
    ['Retrieval runs as the end user',
     "The vector search is filtered by the caller's permissions before any chunk reaches the model. A broad service account doing retrieval turns the app's access into every user's access."],
    ['Access control is enforced at retrieval',
     'Document- and row-level rules are applied as metadata filters on the search itself. A system-prompt instruction is not a control, and redacting after generation is too late because the data already entered the context.'],
    ['Retrieved text is treated as untrusted input',
     'A chunk that says "ignore previous instructions" is indirect prompt injection from your own corpus. Retrieved content is data, never instructions.'],
    ['Injection defences limit what the model can do',
     'Retrieved content is clearly delimited, and the actions and tools available to the model are restricted, so a successful injection has a small blast radius.'],
    ['Chunks are sized for precision',
     'Oversized chunks blur the embedding and fill the context window with noise, which raises cost and dilutes answers. A focused chunk usually retrieves better.'],
    ['PII is handled before embedding',
     'PII is redacted, tokenised, or access-gated at ingestion. Vectors and the chunk text stored beside them are data at rest with the same obligations as any other store.'],
    ['Every answer can be reconstructed',
     'The audit log records the query, who asked, which documents were retrieved, and what was returned, with a defined retention period.'],
    ['Retrieval changes are measured',
     'An eval harness with a labelled question set and retrieval metrics runs on every change to chunking, embeddings, or prompts. Vendor benchmarks are not a substitute for your own data.'],
    ['Repeated load is absorbed by caching',
     'Embeddings and retrieval or generation results are cached for repeated and semantically similar queries before more compute is added.'],
    ['Agent tools follow least privilege',
     'Where the model can call tools, injected text can steer those calls. Each tool grants only what the task needs, and consequential actions need a separate check.'],
];
?>
<section class="page-head container no-print-pad">
  <p class="eyebrow">Free resource</p>
  <h1>RAG security: a 10-point self-assessment</h1>
  <p class="page-lead">Tick each item your retrieval-augmented system meets today. Anything unticked is where to start.
     Prints to one page.</p>
</section>

<section class="container narrow-section checklist-section">
  <ol class="checklist">
    <?php foreach ($items as $i => [$title, $body]): ?>
    <li class="checklist-item">
      <label class="checklist-label">
        <input type="checkbox" class="checklist-box" data-check="<?= $i ?>">
        <span>
          <strong><?= e($title) ?></strong>
          <span class="checklist-body"><?= e($body) ?></span>
        </span>
      </label>
    </li>
    <?php endforeach; ?>
  </ol>

  <p class="checklist-score" aria-live="polite"><span id="checkScore">0</span> of <?= count($items) ?> in place.</p>

  <div class="checklist-actions no-print">
    <button type="button" class="btn btn-primary" onclick="window.print()">Print or save as PDF</button>
    <a class="btn btn-outline" href="/blog/is-your-rag-pipeline-actually-secure-a-10-question-gut-check">Take the quiz version</a>
  </div>

  <div class="resource-callout no-print">
    <h2>Want a second pair of eyes?</h2>
    <p>A RAG security review walks through these ten areas against your actual pipeline and returns a
       prioritised list of fixes.</p>
    <a class="btn btn-outline" href="/services#rag-security">About the RAG security review</a>
  </div>

  <p class="print-only checklist-source">From datadinosaur.com/resources/rag-security-checklist · Jeremy DeGardeyn</p>
</section>
<script>
(function () {
  var boxes = document.querySelectorAll('.checklist-box');
  var out = document.getElementById('checkScore');
  var KEY = 'dd-rag-checklist';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  function update() {
    var n = 0, state = {};
    boxes.forEach(function (b) { if (b.checked) { n++; state[b.dataset.check] = 1; } });
    out.textContent = n;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  boxes.forEach(function (b) {
    if (saved[b.dataset.check]) b.checked = true;
    b.addEventListener('change', update);
  });
  update();
})();
</script>
