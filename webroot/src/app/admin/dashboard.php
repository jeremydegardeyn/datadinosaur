<?php
$pdo = db_connect();

// Stats
$total_posts    = (int)$pdo->query("SELECT COUNT(*) FROM blog_posts")->fetchColumn();
$published      = (int)$pdo->query("SELECT COUNT(*) FROM blog_posts WHERE status='published'")->fetchColumn();
$drafts         = $total_posts - $published;
$pending_cmts   = (int)$pdo->query("SELECT COUNT(*) FROM blog_comments WHERE status='pending'")->fetchColumn();
$new_inquiries  = (int)$pdo->query("SELECT COUNT(*) FROM contact_inquiries WHERE status='new'")->fetchColumn();

// Recent posts
$posts_stmt = $pdo->query("SELECT id, title, slug, status, visible, pinned, published_at, views FROM blog_posts ORDER BY updated_at DESC LIMIT 20");
$posts = $posts_stmt->fetchAll();

// Pending comments
$cmts_stmt = $pdo->prepare("SELECT c.*, p.title AS post_title, p.slug AS post_slug FROM blog_comments c JOIN blog_posts p ON p.id = c.post_id WHERE c.status = 'pending' ORDER BY c.created_at DESC LIMIT 20");
$cmts_stmt->execute();
$pending_comments = $cmts_stmt->fetchAll();

// Approved comments
$approved_stmt = $pdo->prepare("SELECT c.*, p.title AS post_title, p.slug AS post_slug FROM blog_comments c JOIN blog_posts p ON p.id = c.post_id WHERE c.status = 'approved' ORDER BY c.created_at DESC LIMIT 30");
$approved_stmt->execute();
$approved_comments = $approved_stmt->fetchAll();

// Recent inquiries
$inq_stmt = $pdo->query("SELECT id, name, email, subject, inquiry_type, status, created_at FROM contact_inquiries ORDER BY created_at DESC LIMIT 20");
$inquiries = $inq_stmt->fetchAll();
?>
<div class="container admin-dashboard">
  <div class="admin-header">
    <h1>Admin Dashboard</h1>
    <div class="admin-header-actions">
      <?php if (!empty($config['analytics']['enabled']) && !empty($config['analytics']['goatcounter_code'])): ?>
      <a href="https://<?= e($config['analytics']['goatcounter_code']) ?>.goatcounter.com"
         class="btn btn-ghost" target="_blank" rel="noopener noreferrer">&#128200; Traffic Stats</a>
      <?php endif; ?>
      <a href="/blog/new" class="btn btn-primary">+ New Post</a>
    </div>
  </div>

  <!-- Stats row -->
  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-num"><?= $published ?></span>
      <span class="stat-label">Published Posts</span>
    </div>
    <div class="stat-card">
      <span class="stat-num"><?= $drafts ?></span>
      <span class="stat-label">Drafts</span>
    </div>
    <div class="stat-card <?= $pending_cmts > 0 ? 'stat-alert' : '' ?>">
      <span class="stat-num"><?= $pending_cmts ?></span>
      <span class="stat-label">Pending Comments</span>
    </div>
    <div class="stat-card <?= $new_inquiries > 0 ? 'stat-alert' : '' ?>">
      <span class="stat-num"><?= $new_inquiries ?></span>
      <span class="stat-label">New Inquiries</span>
    </div>
  </div>

  <!-- Posts table -->
  <section class="admin-section">
    <h2>Posts</h2>
    <table class="admin-table">
      <thead>
        <tr><th>Title</th><th>Status</th><th class="col-visible">Public</th><th class="col-pinned">Pinned</th><th>Views</th><th>Published</th><th></th></tr>
      </thead>
      <tbody>
        <?php foreach ($posts as $p): ?>
        <?php $isVisible = (bool)(int)$p['visible']; $isPinned = (bool)(int)$p['pinned']; ?>
        <tr data-post-id="<?= (int)$p['id'] ?>"<?= !$isVisible ? ' class="post-hidden"' : '' ?>>
          <td><a href="/blog/<?= e($p['slug']) ?>"><?= e($p['title']) ?></a></td>
          <td><span class="badge badge-<?= $p['status'] ?>"><?= $p['status'] ?></span></td>
          <td class="col-visible">
            <label class="visibility-toggle" title="<?= $isVisible ? 'Visible — click to hide' : 'Hidden — click to show' ?>">
              <input type="checkbox" <?= $isVisible ? 'checked' : '' ?>
                     onchange="togglePostVisibility(<?= (int)$p['id'] ?>, this.checked, '<?= e(csrf_token()) ?>')">
            </label>
          </td>
          <td class="col-pinned">
            <label class="pin-toggle" title="<?= $isPinned ? 'Pinned — click to unpin' : 'Not pinned — click to pin' ?>">
              <input type="checkbox" <?= $isPinned ? 'checked' : '' ?>
                     onchange="togglePostPin(<?= (int)$p['id'] ?>, this.checked, '<?= e(csrf_token()) ?>')">
            </label>
          </td>
          <td><?= (int)$p['views'] ?></td>
          <td><?= $p['published_at'] ? date('M j, Y', strtotime($p['published_at'])) : '—' ?></td>
          <td><a href="/blog/edit?id=<?= (int)$p['id'] ?>" class="btn-sm">Edit</a></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </section>

  <!-- Pending comments -->
  <?php if (!empty($pending_comments)): ?>
  <section class="admin-section">
    <h2>Pending Comments</h2>
    <?php foreach ($pending_comments as $c): ?>
    <div class="comment-moderation" data-comment-id="<?= (int)$c['id'] ?>">
      <div class="comment-moderation-meta">
        <strong><?= e($c['author_name']) ?></strong> on
        <a href="/blog/<?= e($c['post_slug']) ?>"><?= e($c['post_title']) ?></a>
        &mdash; <?= date('M j, Y g:ia', strtotime($c['created_at'])) ?>
      </div>
      <p><?= e($c['content']) ?></p>
      <div class="comment-actions">
        <button class="btn btn-primary btn-sm" onclick="moderateComment(<?= $c['id'] ?>, 'approve', '<?= e(csrf_token()) ?>')">Approve</button>
        <button class="btn btn-danger  btn-sm" onclick="moderateComment(<?= $c['id'] ?>, 'spam',    '<?= e(csrf_token()) ?>')">Spam</button>
        <button class="btn btn-ghost   btn-sm" onclick="moderateComment(<?= $c['id'] ?>, 'delete',  '<?= e(csrf_token()) ?>')">Delete</button>
      </div>
    </div>
    <?php endforeach; ?>
  </section>
  <?php endif; ?>

  <!-- Approved comments -->
  <?php if (!empty($approved_comments)): ?>
  <section class="admin-section">
    <h2>Approved Comments</h2>
    <?php foreach ($approved_comments as $c): ?>
    <div class="comment-moderation" data-comment-id="<?= (int)$c['id'] ?>">
      <div class="comment-moderation-meta">
        <strong><?= e($c['author_name']) ?></strong> on
        <a href="/blog/<?= e($c['post_slug']) ?>"><?= e($c['post_title']) ?></a>
        &mdash; <?= date('M j, Y g:ia', strtotime($c['created_at'])) ?>
      </div>
      <p><?= e($c['content']) ?></p>
      <div class="comment-actions">
        <button class="btn btn-danger btn-sm" onclick="moderateComment(<?= $c['id'] ?>, 'spam',   '<?= e(csrf_token()) ?>')">Spam</button>
        <button class="btn btn-ghost  btn-sm" onclick="moderateComment(<?= $c['id'] ?>, 'delete', '<?= e(csrf_token()) ?>')">Delete</button>
      </div>
    </div>
    <?php endforeach; ?>
  </section>
  <?php endif; ?>

  <!-- Inquiries -->
  <?php if (!empty($inquiries)): ?>
  <section class="admin-section">
    <h2>Contact Inquiries</h2>
    <table class="admin-table">
      <thead>
        <tr><th>From</th><th>Subject</th><th>Type</th><th>Status</th><th>Date</th><th></th></tr>
      </thead>
      <tbody>
        <?php foreach ($inquiries as $q): ?>
        <tr data-inquiry-id="<?= (int)$q['id'] ?>">
          <td><?= e($q['name']) ?><br><small><?= e($q['email']) ?></small></td>
          <td><?= e($q['subject']) ?></td>
          <td><?= e($q['inquiry_type']) ?></td>
          <td><span class="badge badge-<?= $q['status'] ?>"><?= $q['status'] ?></span></td>
          <td><?= date('M j, Y', strtotime($q['created_at'])) ?></td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteInquiry(<?= (int)$q['id'] ?>, '<?= e(csrf_token()) ?>')">Delete</button></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </section>
  <?php endif; ?>
</div>
