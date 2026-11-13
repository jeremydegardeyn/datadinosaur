<?php
$post = get_post_by_slug($slug);
if (!$post) {
    http_response_code(404);
    $seo_noindex = true;
    require SRC_ROOT . '/app/404.php';
    return;
}

$base          = rtrim($config['site']['base_url'], '/');
$author        = author_name($post, $config);
$hide_footer_subscribe = true;   // the post ends with its own signup block
// Long headlines get truncated in search results at ~60 characters; don't
// spend those characters on the site name.
$page_title    = mb_strlen($post['title']) > 50 ? $post['title'] : $post['title'] . ' — ' . $config['site']['name'];
$excerpt       = $post['excerpt'] ?: auto_excerpt($post['content'], 160);
$meta_desc     = mb_strimwidth(strip_tags($excerpt), 0, 160, '…');
$og_title      = $post['title'];
$og_type       = 'article';
$canonical_url = $base . '/blog/' . $post['slug'];
$og_rel        = dd_post_og_image($post, $config);
if ($og_rel) $og_image = $base . $og_rel;
$modified      = post_modified_at($post);
$social_urls   = array_map(fn ($s) => $s['href'], $config['footer']['social'] ?? []);

$crumbs = [
    ['@type' => 'ListItem', 'position' => 1, 'name' => 'Blog', 'item' => $base . '/blog'],
];
if (!empty($post['series'])) {
    $crumbs[] = ['@type' => 'ListItem', 'position' => 2, 'name' => $post['series'],
                 'item' => $base . '/series/' . series_slug($post['series'])];
}
$crumbs[] = ['@type' => 'ListItem', 'position' => count($crumbs) + 1, 'name' => $post['title'], 'item' => $canonical_url];

$json_ld = json_encode([
    '@context' => 'https://schema.org',
    '@graph'   => [
        array_filter([
            '@type'            => 'BlogPosting',
            'headline'         => mb_strimwidth($post['title'], 0, 110, '…'),
            'description'      => $meta_desc,
            'url'              => $canonical_url,
            'mainEntityOfPage' => $canonical_url,
            'image'            => $og_image,
            'datePublished'    => $post['published_at'] ? date('c', strtotime($post['published_at'])) : null,
            'dateModified'     => $modified ? date('c', strtotime($modified)) : null,
            'articleSection'   => $post['category_name'] ?: null,
            'isPartOf'         => !empty($post['series'])
                ? ['@type' => 'CreativeWorkSeries', 'name' => $post['series'],
                   'url' => $base . '/series/' . series_slug($post['series'])]
                : null,
            'wordCount'        => str_word_count(strip_tags($post['content'])),
            'author'           => [
                '@type'    => 'Person',
                'name'     => $author,
                'url'      => $base . '/about',
                'jobTitle' => $config['site']['author_title'] ?? null,
                'sameAs'   => $social_urls,
            ],
            'publisher'        => [
                '@type' => 'Organization',
                'name'  => $config['site']['name'],
                'url'   => $base,
                'logo'  => ['@type' => 'ImageObject', 'url' => $base . '/assets/images/data_dinosaur.png'],
            ],
        ], fn ($v) => $v !== null),
        ['@type' => 'BreadcrumbList', 'itemListElement' => $crumbs],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

[$html_content, $toc] = dd_add_heading_anchors(render_post_html($post['content']));

$comments   = get_comments((int)$post['id'], true);
$rt         = reading_time($post['content']);
$summary    = array_values(array_filter(array_map(
    fn ($l) => trim(ltrim(trim($l), "-*• \t")),
    preg_split('/\r\n|\r|\n/', (string)($post['summary'] ?? ''))
)));
$show_toc   = count($toc) >= 3 && $rt >= 6;
$series     = !empty($post['series']) ? get_series_posts($post['series']) : [];
$series_idx = null;
foreach ($series as $i => $sp) if ((int)$sp['id'] === (int)$post['id']) $series_idx = $i;
$related    = get_related_posts($post, 3);
$has_code   = str_contains($html_content, '<pre>');
$share_url  = rawurlencode($canonical_url);

// The consulting nudge at the end of a post matches what the post is about.
$cat_cta = [
    'governance' => ['AI gateway or governance design', 'An independent review of how model and agent traffic is governed: where policy binds, who can change it, and how fast you can stop an agent.'],
    'agent'      => ['Agent and eval engineering', 'A review of how your agents are grounded, evaluated, and observed in production, and which parts you can hand to a managed service.'],
    'platform'   => ['Data platform review', 'An independent review of your pipelines, storage, and cost on Google Cloud, with recommendations you can act on.'],
    'career'     => ['Team and career coaching', 'One-on-one sessions for data engineers and architects working through the shift to AI.'],
];
$cat_l = mb_strtolower((string)($post['category_name'] ?? ''));
$cta = match (true) {
    str_contains($cat_l, 'governance') || str_contains($cat_l, 'gateway') => $cat_cta['governance'],
    str_contains($cat_l, 'agent') || str_contains($cat_l, 'ai')           => $cat_cta['agent'],
    str_contains($cat_l, 'career') || str_contains($cat_l, 'skill')
        || str_contains($cat_l, 'craft') || str_contains($cat_l, 'productiv') => $cat_cta['career'],
    default                                                                  => $cat_cta['platform'],
};
?>
<div class="read-progress" aria-hidden="true"><span id="readProgress"></span></div>

<article class="post-single container<?= $show_toc ? ' has-toc' : '' ?>">
  <header class="post-header">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/blog">Blog</a>
      <?php if (!empty($post['series'])): ?>
      <span aria-hidden="true">/</span>
      <a href="/series/<?= e(series_slug($post['series'])) ?>"><?= e($post['series']) ?></a>
      <?php endif; ?>
    </nav>

    <div class="post-meta-top">
      <?php if ($config['blog']['show_category'] && $post['category_name']): ?>
      <a href="/blog?cat=<?= (int)$post['category_id'] ?>" class="post-category">
        <?= e($post['category_name']) ?>
      </a>
      <?php endif; ?>
      <?php if ($config['blog']['show_read_time']): ?>
      <span class="read-time"><?= $rt ?> min read</span>
      <?php endif; ?>
    </div>

    <h1 class="post-title"><?= e($post['title']) ?></h1>

    <div class="post-meta-row">
      <?php if ($config['blog']['show_author']): ?>
      <a class="post-author" href="/about">By <?= e($author) ?></a>
      <?php endif; ?>
      <?php if ($config['blog']['show_date']): ?>
      <time datetime="<?= e(date('c', strtotime($post['published_at']))) ?>">
        <?= date($config['blog']['date_format'], strtotime($post['published_at'])) ?>
      </time>
      <?php if ($modified && date('Y-m-d', strtotime($modified)) > date('Y-m-d', strtotime($post['published_at']) + 86400)): ?>
      <span class="post-updated">Updated <?= date($config['blog']['date_format'], strtotime($modified)) ?></span>
      <?php endif; ?>
      <?php endif; ?>
      <?php if (is_admin()): ?>
      <a href="/blog/edit?id=<?= (int)$post['id'] ?>" class="btn-admin-edit">Edit Post</a>
      <?php endif; ?>
    </div>

    <?php if ($series_idx !== null && count($series) > 1): ?>
    <p class="series-note">
      Part <?= $series_idx + 1 ?> of <?= count($series) ?> in the
      <a href="/series/<?= e(series_slug($post['series'])) ?>"><?= e($post['series']) ?></a> series.
    </p>
    <?php endif; ?>
  </header>

  <?php if ($summary): ?>
  <aside class="post-summary" aria-label="Key points">
    <p class="post-summary-title">Key points</p>
    <ul>
      <?php foreach ($summary as $s): ?>
      <li><?= e($s) ?></li>
      <?php endforeach; ?>
    </ul>
  </aside>
  <?php endif; ?>

  <?php if ($show_toc): ?>
  <nav class="post-toc" aria-label="On this page">
    <details open>
      <summary>On this page</summary>
      <ol>
        <?php foreach ($toc as $t): ?>
        <li><a href="#<?= e($t['id']) ?>"><?= e($t['text']) ?></a></li>
        <?php endforeach; ?>
      </ol>
    </details>
  </nav>
  <?php endif; ?>

  <div class="post-body prose">
    <?= $html_content ?>
  </div>

  <?php if ($series_idx !== null && count($series) > 1): ?>
  <nav class="series-nav" aria-label="Series navigation">
    <?php if ($series_idx > 0): $prev = $series[$series_idx - 1]; ?>
    <a class="series-nav-link prev" href="/blog/<?= e($prev['slug']) ?>">
      <span class="series-nav-label">&larr; Previous in <?= e($post['series']) ?></span>
      <span class="series-nav-title"><?= e($prev['title']) ?></span>
    </a>
    <?php else: ?><span></span><?php endif; ?>
    <?php if ($series_idx < count($series) - 1): $next = $series[$series_idx + 1]; ?>
    <a class="series-nav-link next" href="/blog/<?= e($next['slug']) ?>">
      <span class="series-nav-label">Next in <?= e($post['series']) ?> &rarr;</span>
      <span class="series-nav-title"><?= e($next['title']) ?></span>
    </a>
    <?php endif; ?>
  </nav>
  <?php endif; ?>

  <div class="post-share">
    <span class="post-share-label">Share</span>
    <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=<?= $share_url ?>"
       target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      LinkedIn
    </a>
    <button type="button" class="share-btn" data-copy-link="<?= e($canonical_url) ?>">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/></svg>
      <span>Copy link</span>
    </button>
  </div>

  <aside class="post-author-box">
    <img src="/assets/images/favicon-180.png" alt="" width="56" height="56" loading="lazy">
    <div>
      <p class="post-author-name"><a href="/about"><?= e($author) ?></a></p>
      <p class="post-author-bio">
        <?= e($config['site']['author_title'] ?? 'Data & AI Architect') ?> with 20+ years in IT and data.
        Writes up working builds on Google Cloud and AWS: what was built, what was measured, and what was not tested.
      </p>
    </div>
  </aside>

  <section class="post-next-steps">
    <div class="next-card">
      <h2>Get the next post by email</h2>
      <p>One email when a new post goes up. No tracking, unsubscribe in one click.</p>
      <?php $subscribe_source = 'post:' . $post['slug']; require SRC_ROOT . '/layout/subscribe-form.php'; ?>
    </div>
    <div class="next-card">
      <h2><?= e($cta[0]) ?></h2>
      <p><?= e($cta[1]) ?></p>
      <a href="/services" class="btn btn-outline">See consulting services</a>
    </div>
  </section>

  <?php if ($related): ?>
  <section class="related-posts" aria-labelledby="relatedHeading">
    <h2 id="relatedHeading">Keep reading</h2>
    <div class="related-grid">
      <?php foreach ($related as $r): ?>
      <a class="related-card" href="/blog/<?= e($r['slug']) ?>">
        <span class="related-title"><?= e($r['title']) ?></span>
        <span class="related-meta"><?= date('M j, Y', strtotime($r['published_at'])) ?> · <?= reading_time($r['content']) ?> min read</span>
      </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <footer class="post-footer">
    <a href="/blog" class="btn btn-ghost">&larr; All Posts</a>
  </footer>
</article>
<?php if ($has_code): ?>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)" id="hljsDark">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light)" id="hljsLight">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" defer></script>
<?php endif; ?>
<script src="/assets/js/blog-slideshow.js?v=1" defer></script>
<script src="/assets/js/blog-quiz.js?v=8" defer></script>
<script src="/assets/js/post.js?v=1" defer></script>

<!-- Comments -->
<?php if ($config['blog']['comments_enabled']): ?>
<section class="comments-section container">
  <h2 class="comments-heading">
    <?= count($comments) ?> Comment<?= count($comments) !== 1 ? 's' : '' ?>
  </h2>

  <?php if (!empty($comments)): ?>
  <div class="comments-list">
    <?php foreach ($comments as $c): ?>
    <div class="comment" data-comment-id="<?= (int)$c['id'] ?>">
      <div class="comment-meta">
        <strong class="comment-author"><?= e($c['author_name']) ?></strong>
        <time><?= date('M j, Y', strtotime($c['created_at'])) ?></time>
        <?php if (is_admin()): ?>
        <button class="btn-admin-delete" onclick="moderateComment(<?= (int)$c['id'] ?>, 'delete', '<?= e(csrf_token()) ?>')">Delete</button>
        <?php endif; ?>
      </div>
      <div class="comment-body"><?= nl2br(e($c['content'])) ?></div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

  <?php if (isset($_GET['comment_success'])): ?>
  <div class="alert alert-success">
    <?= $config['blog']['comment_moderation']
        ? 'Thanks! Your comment is awaiting moderation.'
        : 'Comment posted!' ?>
  </div>
  <?php endif; ?>

  <div class="comment-form-wrap">
    <h3>Leave a Comment</h3>
    <form method="POST" action="/api/blog" class="comment-form">
      <input type="hidden" name="action"     value="comment">
      <input type="hidden" name="post_id"    value="<?= (int)$post['id'] ?>">
      <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
      <div class="form-row">
        <label><span>Name <span class="field-note">(Optional)</span></span>
          <input type="text" name="author_name" maxlength="100">
        </label>
        <label><span>Email <span class="field-note">(Optional — not published)</span></span>
          <input type="email" name="author_email" maxlength="200">
        </label>
      </div>
      <label>Comment *
        <textarea name="content" rows="5" required maxlength="2000"></textarea>
      </label>
      <button type="submit" class="btn btn-primary">Post Comment</button>
    </form>
  </div>
</section>
<?php endif; ?>
