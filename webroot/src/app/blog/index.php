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
?>
<div class="container blog-layout <?= $show_sidebar ? 'has-sidebar' : '' ?>">
  <div class="blog-main">
    <h1 class="page-heading">Blog</h1>
    <?php if ($cat_id): ?>
    <?php $cat_name = array_values(array_filter($categories, fn($c) => $c['id'] === $cat_id))[0]['name'] ?? 'Category'; ?>
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
      <article class="post-row">
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
          <span class="post-author">By <?= e($p['author']) ?></span>
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
    <?php break; case 'categories': ?>
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
      <h3>Need help?</h3>
      <p>I offer data consulting on architecture, governance, and AI integration.</p>
      <a href="/contact" class="btn btn-primary btn-full">Get in Touch</a>
    </div>
  </aside>
  <?php endif; ?>
</div>
