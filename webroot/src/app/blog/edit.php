<?php
$post_id   = isset($_GET['id']) ? (int)$_GET['id'] : null;
$post      = $post_id ? get_post_by_id($post_id) : null;
$categories = get_categories();
$is_new    = $post === null;
$page_title = ($is_new ? 'New Post' : 'Edit: ' . $post['title']) . ' — Admin';
?>
<div class="container admin-edit">
  <div class="admin-edit-header">
    <h1><?= $is_new ? 'New Post' : 'Edit Post' ?></h1>
    <a href="/admin" class="btn btn-ghost">&larr; Dashboard</a>
  </div>

  <form method="POST" action="/api/blog" class="post-edit-form" id="editForm">
    <input type="hidden" name="action"     value="<?= $is_new ? 'create' : 'update' ?>">
    <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
    <?php if (!$is_new): ?>
    <input type="hidden" name="post_id" value="<?= (int)$post['id'] ?>">
    <?php endif; ?>

    <div class="form-row">
      <label class="label-full">Title *
        <input type="text" name="title" id="postTitle" required maxlength="255"
               value="<?= $is_new ? '' : e($post['title']) ?>"
               placeholder="Post title...">
      </label>
    </div>

    <div class="form-row">
      <label>Slug
        <input type="text" name="slug" id="postSlug" maxlength="280"
               value="<?= $is_new ? '' : e($post['slug']) ?>"
               placeholder="auto-generated from title">
      </label>
      <label>Category
        <select name="category_id">
          <option value="">— None —</option>
          <?php foreach ($categories as $c): ?>
          <option value="<?= (int)$c['id'] ?>"
            <?= (!$is_new && (int)$post['category_id'] === (int)$c['id']) ? 'selected' : '' ?>>
            <?= e($c['name']) ?>
          </option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Status
        <select name="status">
          <option value="draft"     <?= (!$is_new && $post['status'] === 'draft')     ? 'selected' : '' ?>>Draft</option>
          <option value="published" <?= ($is_new || $post['status'] === 'published')   ? 'selected' : '' ?>>Published</option>
        </select>
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="pinned" value="1"
               <?= (!$is_new && !empty($post['pinned'])) ? 'checked' : '' ?>>
        📌 Pin to top
      </label>
    </div>

    <label>Excerpt <span class="field-note">(optional — auto-generated if blank)</span>
      <textarea name="excerpt" rows="2" maxlength="500"
                placeholder="Short description for listings..."><?= $is_new ? '' : e($post['excerpt']) ?></textarea>
    </label>

    <div class="editor-wrap">
      <label>Content * <span class="field-note">(Markdown supported)</span>
        <div class="editor-tabs">
          <button type="button" class="editor-tab active" data-tab="write">Write</button>
          <button type="button" class="editor-tab" data-tab="preview">Preview</button>
        </div>
        <textarea name="content" id="postContent" rows="28" required
                  class="md-editor"
                  placeholder="Write your post in Markdown..."><?= $is_new ? '' : e($post['content']) ?></textarea>
        <div id="mdPreview" class="md-preview prose" style="display:none"></div>
      </label>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn btn-primary">
        <?= $is_new ? 'Publish Post' : 'Save Changes' ?>
      </button>
      <?php if (!$is_new): ?>
      <button type="button" class="btn btn-danger"
              onclick="deletePost(<?= (int)$post['id'] ?>, '<?= e(csrf_token()) ?>')">
        Delete Post
      </button>
      <?php endif; ?>
    </div>
  </form>
</div>
