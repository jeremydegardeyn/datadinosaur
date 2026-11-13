<?php
// Each area links to the posts that show the work, so a visitor can judge
// the approach before getting in touch.
$areas = [
    ['gateway', 'AI gateway and agent governance', 'ai-gateway',
     'How model calls and agent tool calls are governed: which gateway carries which traffic, where policy binds, how the registry works, and how fast one agent can be stopped.',
     ['choosing-an-ai-gateway-operating-model', 'one-registry-one-gateway-two-clouds-testing-ai-agent-containment-across-aws-and-google-cloud']],
    ['lock', 'RAG security review', 'rag-security',
     'Access control at retrieval, prompt-injection exposure, PII in the index, audit logging, and evals, checked against your pipeline rather than a generic list.',
     ['is-your-rag-pipeline-actually-secure-a-10-question-gut-check', 'your-rag-problem-might-be-a-data-issue-not-retrieval-issue']],
    ['agent', 'Agent evaluation and observability', 'agent-evals',
     'Which parts of an eval framework to build, which to buy from a managed service, and how evals, tracing, and alerting fit together in production.',
     ['which-parts-of-your-eval-framework-you-can-stop-maintaining', 'make-agent-evals-part-of-your-observability']],
    ['layers', 'Data architecture review', 'architecture',
     'An independent look at pipelines, storage, access patterns, and cost on Google Cloud, and how well the platform positions you for AI workloads. Recommendations you can act on, not a vendor pitch.',
     ['alternative-to-buying-capacity-to-fix-dataflow-stockouts', 'stop-your-gcp-bill-before-it-stops-you']],
    ['database', 'Governance and metadata', 'governance',
     'Data catalogs, ownership and stewardship, lineage, and data products, set up so people keep using them.',
     ['managing-data-products-in-google-clouds-knowledge-catalog', 'stacking-governance-layers-without-losing-track-of-them']],
    ['users', 'Team and career coaching', 'coaching',
     'One-on-one sessions for data engineers and architects working through the shift to AI: portfolio and GitHub feedback, interview preparation, and honest career advice.',
     ['data-engineering-durable-skills', 'what-im-actually-looking-for-when-i-interview-a-data-qaqe-engineer']],
];
$all_slugs = array_merge(...array_map(fn ($a) => $a[4], $areas));
$by_slug = [];
foreach (get_posts_by_slugs($all_slugs) as $p) $by_slug[$p['slug']] = $p;
?>
<div class="container page-content">
  <h1 class="page-heading">Consulting services</h1>
  <p class="page-lead">
    Independent reviews from someone who builds and measures this work hands-on. Every engagement has a
    written scope agreed before it starts and ends with a prioritised list of findings.
  </p>

  <h2 class="services-subhead">Scoped reviews</h2>
  <div class="offer-grid">
    <div class="offer-card" id="gateway-review">
      <span class="card-icon"><?= icon('gateway', 22) ?></span>
      <h3>AI Gateway Readiness Review</h3>
      <p>For teams putting model and agent traffic through a gateway, or about to.</p>
      <ul class="offer-list">
        <li>Map current model and MCP tool traffic and which gateway or path carries each</li>
        <li>Check where policy binds and who can change it</li>
        <li>Test how an agent is identified, registered, and stopped</li>
        <li>Written findings with a recommended operating model</li>
      </ul>
      <a class="btn btn-primary" href="/contact?type=gateway">Ask about this review</a>
    </div>
    <div class="offer-card" id="rag-security-review">
      <span class="card-icon"><?= icon('lock', 22) ?></span>
      <h3>RAG Security Assessment</h3>
      <p>For a retrieval-augmented assistant that is in production or close to it.</p>
      <ul class="offer-list">
        <li>Walk the ten areas of the <a href="/resources/rag-security-checklist">RAG security checklist</a> against your pipeline</li>
        <li>Check retrieval-time access control and injection exposure</li>
        <li>Review PII handling, audit logging, and the eval set</li>
        <li>Written findings ranked by risk, with fixes</li>
      </ul>
      <a class="btn btn-primary" href="/contact?type=rag">Ask about this assessment</a>
    </div>
  </div>

  <h2 class="services-subhead">Other areas</h2>
  <div class="services-grid">
    <?php foreach ($areas as [$ic, $title, $anchor, $body, $slugs]): ?>
    <div class="service-card" id="<?= e($anchor) ?>">
      <span class="card-icon"><?= icon($ic, 22) ?></span>
      <h3><?= e($title) ?></h3>
      <p><?= e($body) ?></p>
      <?php $reads = array_filter(array_map(fn ($s) => $by_slug[$s] ?? null, $slugs)); if ($reads): ?>
      <p class="service-reading-label">Related reading</p>
      <ul class="service-reading">
        <?php foreach ($reads as $r): ?>
        <li><a href="/blog/<?= e($r['slug']) ?>"><?= e($r['title']) ?></a></li>
        <?php endforeach; ?>
      </ul>
      <?php endif; ?>
    </div>
    <?php endforeach; ?>
  </div>

  <div class="services-cta">
    <h2>How it works</h2>
    <ol class="how-it-works">
      <li>Send a short description of what you're working on through the contact form.</li>
      <li>I reply within one to two business days to discuss scope and availability.</li>
      <li>We agree a written scope and format: a one-time review, a short series of sessions, or ad-hoc hours.</li>
    </ol>
    <a href="/contact" class="btn btn-primary btn-lg">Start a conversation</a>
  </div>
</div>
