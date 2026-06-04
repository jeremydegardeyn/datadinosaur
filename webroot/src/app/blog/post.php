<?php
$post = get_post_by_slug($slug);
if (!$post) {
    http_response_code(404);
    require SRC_ROOT . '/app/404.php';
    return;
}

$page_title    = $post['title'] . ' — ' . $config['site']['name'];
$excerpt       = $post['excerpt'] ?: auto_excerpt($post['content'], 160);
$meta_desc     = mb_strimwidth(strip_tags($excerpt), 0, 160, '…');
$og_title      = $post['title'];
$og_type       = 'article';
$canonical_url = $config['site']['base_url'] . '/blog/' . $post['slug'];
$json_ld       = json_encode([
    '@context'        => 'https://schema.org',
    '@type'           => 'BlogPosting',
    'headline'        => $post['title'],
    'description'     => $meta_desc,
    'url'             => $canonical_url,
    'datePublished'   => $post['published_at'] ? date('c', strtotime($post['published_at'])) : null,
    'dateModified'    => $post['updated_at']   ? date('c', strtotime($post['updated_at']))   : null,
    'author'          => ['@type' => 'Person', 'name' => $post['author'] ?? $config['site']['author']],
    'publisher'       => [
        '@type' => 'Organization',
        'name'  => $config['site']['name'],
        'url'   => $config['site']['base_url'],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$parsedown = new Parsedown();
$parsedown->setSafeMode(true);
$html_content = $parsedown->text($post['content']);

$comments = get_comments((int)$post['id'], true);
$rt = reading_time($post['content']);
?>
<article class="post-single container">
  <header class="post-header">
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
      <span class="post-author">By <?= e($post['author']) ?></span>
      <?php endif; ?>
      <?php if ($config['blog']['show_date']): ?>
      <time datetime="<?= e($post['published_at']) ?>">
        <?= date($config['blog']['date_format'], strtotime($post['published_at'])) ?>
      </time>
      <?php endif; ?>
      <?php if (is_admin()): ?>
      <a href="/blog/edit?id=<?= (int)$post['id'] ?>" class="btn-admin-edit">Edit Post</a>
      <?php endif; ?>
    </div>
  </header>

  <div class="post-body prose">
    <?= $html_content ?>
  </div>

  <footer class="post-footer">
    <a href="/blog" class="btn btn-ghost">&larr; All Posts</a>
    <a href="/contact" class="btn btn-outline">Need consulting help?</a>
  </footer>
</article>

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
