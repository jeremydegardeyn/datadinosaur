<?php
$current_page = max(1, (int)($_GET['p'] ?? 1));
$cat_id       = isset($_GET['cat']) ? (int)$_GET['cat'] : null;
$per_page     = (int)$config['blog']['posts_per_page'];
$total        = count_posts($cat_id);
$total_pages  = max(1, (int)ceil($total / $per_page));
$current_page = min($current_page, $total_pages);
$posts        = get_posts($current_page, $per_page, $cat_id);
$categories   = get_categories();
$show_sidebar = $config['blog']['show_sidebar'] ?? true;

// Category and page 2+ views are distinct pages: give each its own canonical
// and description instead of collapsing them all onto /blog.
$base   = rtrim($config['site']['base_url'], '/');
$qs     = [];
if ($cat_id) $qs['cat'] = $cat_id;
if ($current_page > 1) $qs['p'] = $current_page;
$canonical_url = $base . '/blog' . ($qs ? '?' . http_build_query($qs) : '');
if ($cat_id) {
    $cat_row = array_values(array_filter($categories, fn ($c) => (int)$c['id'] === $cat_id))[0] ?? null;
    if ($cat_row) {
        $page_title = $cat_row['name'] . ' — Blog — ' . $config['site']['name'];
        $og_title   = $cat_row['name'] . ' posts on DataDinosaur';
        $meta_desc  = (int)$cat_row['post_count'] . ' posts on ' . $cat_row['name']
                    . ' from DataDinosaur: hands-on write-ups of working builds, with what was measured and what was not tested.';
    } else {
        $seo_noindex = true;
    }
}
if ($current_page > 1) $page_title = 'Page ' . $current_page . ' — ' . $page_title;
?>
<div class="container blog-layout <?= $show_sidebar ? 'has-sidebar' : '' ?>">
  <div class="blog-main">
    <h1 class="page-heading">Blog</h1>
    <?php if ($cat_id): ?>
    <?php $cat_name = array_values(array_filter($categories, fn($c) => (int)$c['id'] === $cat_id))[0]['name'] ?? 'Category'; ?>
    <p class="filter-notice">Filtered by: <strong><?= e($cat_name) ?></strong>
      &nbsp;<a href="/blog">&times; clear</a></p>
    <?php endif; ?>

    <?php if (empty($posts)): ?>
    <p class="empty-state">No posts found. Check back soon!</p>
    <?php else: ?>
    <div class="post-list">
      <?php foreach ($posts as $p):
        $excerpt = $p['excerpt'] ?: auto_excerpt($p['content'], $config['blog']['excerpt_length']);
        $rt = reading_time($p['content']);
      ?>
      <article class="post-row<?= !empty($p['pinned']) ? ' post-row--pinned' : '' ?>">
        <?php if (!empty($p['pinned'])): ?>
        <span class="pinned-badge">Pinned</span>
        <?php endif; ?>
        <div class="post-row-meta">
          <?php if ($config['blog']['show_date']): ?>
          <time datetime="<?= e($p['published_at']) ?>">
            <?= date($config['blog']['date_format'], strtotime($p['published_at'])) ?>
          </time>
          <?php endif; ?>
          <?php if ($config['blog']['show_category'] && $p['category_name']): ?>
          <a href="/blog?cat=<?= (int)$p['category_id'] ?>" class="post-category">
            <?= e($p['category_name']) ?>
          </a>
          <?php endif; ?>
          <?php if ($config['blog']['show_read_time']): ?>
          <span class="read-time"><?= $rt ?> min read</span>
          <?php endif; ?>
        </div>
        <h2 class="post-row-title">
          <a href="/blog/<?= e($p['slug']) ?>"><?= e($p['title']) ?></a>
        </h2>
        <p class="post-row-excerpt"><?= e($excerpt) ?></p>
        <div class="post-row-footer">
          <?php if ($config['blog']['show_author']): ?>
          <span class="post-author">By <?= e(author_name($p, $config)) ?></span>
          <?php endif; ?>
          <a href="/blog/<?= e($p['slug']) ?>" class="post-read-more">Continue reading &rarr;</a>
          <?php if (is_admin()): ?>
          <a href="/blog/edit?id=<?= (int)$p['id'] ?>" class="btn-admin-edit">Edit</a>
          <?php endif; ?>
        </div>
      </article>

      <?php if ($config['ads']['enabled'] && ($post_count ?? 0) % 3 === 2 && !empty($config['ads']['between_posts_ad_code'])): ?>
      <div class="ad-slot"><?= $config['ads']['between_posts_ad_code'] ?></div>
      <?php endif; ?>

      <?php $post_count = ($post_count ?? 0) + 1; ?>
      <?php endforeach; ?>
    </div>

    <!-- Pagination -->
    <?php if ($total_pages > 1): ?>
    <nav class="pagination">
      <?php if ($current_page > 1): ?>
      <a href="/blog?p=<?= $current_page - 1 ?><?= $cat_id ? '&cat='.$cat_id : '' ?>" class="btn btn-ghost">&larr; Newer</a>
      <?php endif; ?>
      <span class="page-indicator"><?= $current_page ?> / <?= $total_pages ?></span>
      <?php if ($current_page < $total_pages): ?>
      <a href="/blog?p=<?= $current_page + 1 ?><?= $cat_id ? '&cat='.$cat_id : '' ?>" class="btn btn-ghost">Older &rarr;</a>
      <?php endif; ?>
    </nav>
    <?php endif; ?>
    <?php endif; ?>
  </div>

  <?php if ($show_sidebar): ?>
  <aside class="blog-sidebar">
    <?php foreach ($config['blog']['sidebar_widgets'] as $widget):
      switch ($widget):
        case 'search': ?>
    <div class="sidebar-widget">
      <h3>Search</h3>
      <form class="search-form" id="sidebarSearch">
        <input type="search" id="searchInput" placeholder="Search posts..." aria-label="Search">
        <button type="submit" class="btn btn-primary">Go</button>
      </form>
      <div id="searchResults" class="search-results"></div>
    </div>
    <?php break; case 'series': $all_series = get_all_series(); if ($all_series): ?>
    <div class="sidebar-widget">
      <h3>Series</h3>
      <ul class="cat-list">
        <?php foreach ($all_series as $s): ?>
        <li>
          <a href="/series/<?= e(series_slug($s['name'])) ?>"><?= e($s['name']) ?></a>
          <span class="cat-count"><?= (int)$s['post_count'] ?></span>
        </li>
        <?php endforeach; ?>
      </ul>
    </div>
    <?php endif; break; case 'categories': ?>
    <div class="sidebar-widget">
      <h3>Categories</h3>
      <ul class="cat-list">
        <?php foreach ($categories as $c): ?>
        <li>
          <a href="/blog?cat=<?= (int)$c['id'] ?>"><?= e($c['name']) ?></a>
          <span class="cat-count"><?= (int)$c['post_count'] ?></span>
        </li>
        <?php endforeach; ?>
      </ul>
    </div>
    <?php break; case 'recent_posts': ?>
    <div class="sidebar-widget">
      <h3>Recent Posts</h3>
      <ul class="recent-list">
        <?php foreach (get_recent_posts(5) as $rp): ?>
        <li><a href="/blog/<?= e($rp['slug']) ?>"><?= e($rp['title']) ?></a></li>
        <?php endforeach; ?>
      </ul>
    </div>
    <?php break; endswitch; endforeach; ?>

    <?php if ($config['ads']['enabled'] && !empty($config['ads']['sidebar_ad_code'])): ?>
    <div class="sidebar-widget ad-slot"><?= $config['ads']['sidebar_ad_code'] ?></div>
    <?php endif; ?>

    <div class="sidebar-widget cta-widget">
      <h3>New posts by email</h3>
      <p>One email per post. No tracking.</p>
      <?php $subscribe_source = 'blog-sidebar'; require SRC_ROOT . '/layout/subscribe-form.php'; ?>
    </div>

    <div class="sidebar-widget cta-widget">
      <h3>Need a second pair of eyes?</h3>
      <p>Independent reviews of AI gateways, RAG security, and data platforms.</p>
      <a href="/services" class="btn btn-outline btn-full">Consulting services</a>
    </div>
  </aside>
  <?php endif; ?>
</div>
