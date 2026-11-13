<?php
// "Start here": the front door for a first-time reader. The five most-read
// posts are picked by slug in config.yaml (start_here.top_posts) so the list
// is curated rather than whatever the bot-inflated view counter says.
$series_all   = get_all_series();
$descriptions = $config['series'] ?? [];
$top          = get_posts_by_slugs($config['start_here']['top_posts'] ?? []);
$series_icon  = ['AI gateway' => 'gateway', 'FinChat build log' => 'agent', 'RAG in practice' => 'search'];
?>
<section class="page-head container">
  <h1>Start here</h1>
  <p class="page-lead">
    DataDinosaur is for architects, platform owners, and data engineers putting AI into production,
    especially in regulated industries. Most posts write up something I built and ran: what was built,
    what was measured, and what the test does not show.
  </p>
</section>

<?php if ($series_all): ?>
<section class="container start-section">
  <h2 class="start-heading">Read a series</h2>
  <div class="start-series-grid">
    <?php foreach ($series_all as $s): ?>
    <a class="start-series-card" href="/series/<?= e(series_slug($s['name'])) ?>">
      <span class="card-icon"><?= icon($series_icon[$s['name']] ?? 'book', 22) ?></span>
      <span class="start-series-name"><?= e($s['name']) ?></span>
      <span class="start-series-desc"><?= e($descriptions[$s['name']] ?? '') ?></span>
      <span class="start-series-count"><?= (int)$s['post_count'] ?> posts &rarr;</span>
    </a>
    <?php endforeach; ?>
  </div>
</section>
<?php endif; ?>

<?php if ($top): ?>
<section class="container start-section">
  <h2 class="start-heading">The five most-read posts</h2>
  <ol class="start-top-list">
    <?php foreach ($top as $p): ?>
    <li>
      <a href="/blog/<?= e($p['slug']) ?>" class="start-top-title"><?= e($p['title']) ?></a>
      <p class="start-top-excerpt"><?= e($p['excerpt'] ?: auto_excerpt($p['content'], 180)) ?></p>
    </li>
    <?php endforeach; ?>
  </ol>
</section>
<?php endif; ?>

<section class="container start-section">
  <h2 class="start-heading">Other ways in</h2>
  <div class="start-other-grid">
    <a class="start-other" href="/resources/rag-security-checklist"><?= icon('checklist', 20) ?> <span>RAG security checklist</span></a>
    <a class="start-other" href="/gauntlet/"><?= icon('gamepad', 20) ?> <span>Play Guardrail Gauntlet</span></a>
    <a class="start-other" href="/blog"><?= icon('book', 20) ?> <span>Browse every post</span></a>
    <a class="start-other" href="/subscribe"><?= icon('mail', 20) ?> <span>Get new posts by email</span></a>
  </div>
</section>
