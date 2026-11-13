<?php
// One series in reading order. $series_name is set by the router.
$series_posts = get_series_posts($series_name);
$descriptions = $config['series'] ?? [];
$intro        = $descriptions[$series_name] ?? null;
$meta_desc    = $intro
    ? mb_strimwidth($intro, 0, 160, '…')
    : 'All ' . count($series_posts) . ' posts in the ' . $series_name . ' series on DataDinosaur, in reading order.';
$canonical_url = rtrim($config['site']['base_url'], '/') . '/series/' . series_slug($series_name);

$base    = rtrim($config['site']['base_url'], '/');
$json_ld = json_encode([
    '@context' => 'https://schema.org',
    '@type'    => 'CreativeWorkSeries',
    'name'     => $series_name,
    'url'      => $canonical_url,
    'description' => $meta_desc,
    'author'   => ['@type' => 'Person', 'name' => $config['site']['author'], 'url' => $base . '/about'],
    'hasPart'  => array_map(fn ($p) => [
        '@type' => 'BlogPosting', 'headline' => $p['title'], 'url' => $base . '/blog/' . $p['slug'],
    ], $series_posts),
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
$total_min = array_sum(array_map(fn ($p) => reading_time($p['content']), $series_posts));
?>
<section class="page-head container">
  <p class="eyebrow">Series · <?= count($series_posts) ?> posts · about <?= $total_min ?> min</p>
  <h1><?= e($series_name) ?></h1>
  <?php if ($intro): ?>
  <p class="page-lead"><?= e($intro) ?></p>
  <?php endif; ?>
</section>

<section class="container narrow-section">
  <ol class="series-list">
    <?php foreach ($series_posts as $i => $p):
      $ex = $p['excerpt'] ?: auto_excerpt($p['content'], 200); ?>
    <li class="series-item">
      <span class="series-num" aria-hidden="true"><?= $i + 1 ?></span>
      <div>
        <h2 class="series-item-title"><a href="/blog/<?= e($p['slug']) ?>"><?= e($p['title']) ?></a></h2>
        <p class="series-item-meta"><?= date('F j, Y', strtotime($p['published_at'])) ?> · <?= reading_time($p['content']) ?> min read</p>
        <p class="series-item-excerpt"><?= e($ex) ?></p>
      </div>
    </li>
    <?php endforeach; ?>
  </ol>

  <div class="series-footer">
    <a href="/start-here" class="btn btn-ghost">&larr; All series</a>
    <a href="/subscribe" class="btn btn-outline">Get the next post by email</a>
  </div>
</section>
