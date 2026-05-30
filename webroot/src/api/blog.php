<?php
declare(strict_types=1);

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// ---- Search (GET) ----
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['q'])) {
    $q       = trim($_GET['q']);
    $results = search_posts($q, 10);
    $out = array_map(fn($r) => [
        'title'        => $r['title'],
        'slug'         => $r['slug'],
        'excerpt'      => $r['excerpt'] ?: auto_excerpt($r['content'] ?? '', 120),
        'published_at' => $r['published_at'],
    ], $results);
    json_response(['results' => $out]);
}

// ---- Post comment ----
if ($action === 'comment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        json_response(['error' => 'Invalid request'], 403);
    }

    $post_id = (int)($_POST['post_id'] ?? 0);
    $name    = trim($_POST['author_name']  ?? '');
    $email   = trim($_POST['author_email'] ?? '');
    $content = trim($_POST['content']      ?? '');

    if (!$post_id || !$content) {
        header('Location: ' . ($_SERVER['HTTP_REFERER'] ?? '/blog'));
        exit;
    }
    if (!$name) $name = 'Anonymous';
    if ($email && !validate_email($email)) {
        header('Location: ' . ($_SERVER['HTTP_REFERER'] ?? '/blog'));
        exit;
    }

    add_comment($post_id, $name, $email, $content);

    // Redirect back to post
    $pdo  = db_connect();
    $stmt = $pdo->prepare("SELECT slug FROM blog_posts WHERE id = ?");
    $stmt->execute([$post_id]);
    $row  = $stmt->fetch();
    $slug = $row['slug'] ?? '';
    header('Location: /blog/' . $slug . '?comment_success=1');
    exit;
}

// ---- Admin: create / update post ----
if (in_array($action, ['create', 'update'], true) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin()) json_response(['error' => 'Unauthorized'], 401);
    if (!verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo         = db_connect();
    $title       = trim($_POST['title']    ?? '');
    $content     = trim($_POST['content']  ?? '');
    $excerpt     = trim($_POST['excerpt']  ?? '');
    $slug_input  = trim($_POST['slug']     ?? '');
    $status      = in_array($_POST['status'] ?? '', ['draft','published']) ? $_POST['status'] : 'draft';
    $category_id = !empty($_POST['category_id']) ? (int)$_POST['category_id'] : null;
    $slug        = $slug_input ?: sanitize_slug($title);

    if (!$title || !$content) {
        header('Location: /blog/new?error=missing_fields');
        exit;
    }

    if ($action === 'create') {
        $stmt = $pdo->prepare(
            "INSERT INTO blog_posts (title, slug, excerpt, content, author, category_id, status, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $pub = $status === 'published' ? date('Y-m-d H:i:s') : null;
        $stmt->execute([$title, $slug, $excerpt, $content, 'Jeremy', $category_id, $status, $pub]);
        $new_id = (int)$pdo->lastInsertId();
        header('Location: /blog/edit?id=' . $new_id . '&saved=1');
        exit;
    }

    // update
    $post_id = (int)($_POST['post_id'] ?? 0);
    $stmt = $pdo->prepare(
        "UPDATE blog_posts
         SET title=?, slug=?, excerpt=?, content=?, category_id=?, status=?,
             published_at = CASE WHEN status != 'published' AND ? = 'published'
                                 THEN NOW() ELSE published_at END,
             updated_at   = NOW()
         WHERE id = ?"
    );
    $stmt->execute([$title, $slug, $excerpt, $content, $category_id, $status, $status, $post_id]);
    header('Location: /blog/edit?id=' . $post_id . '&saved=1');
    exit;
}

// ---- Admin: delete post ----
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin()) json_response(['error' => 'Unauthorized'], 401);
    if (!verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo = db_connect();
    $pdo->prepare("DELETE FROM blog_posts WHERE id = ?")->execute([(int)$_POST['post_id']]);
    json_response(['ok' => true]);
}

// ---- Admin: moderate comment ----
if ($action === 'moderate_comment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin()) json_response(['error' => 'Unauthorized'], 401);
    if (!verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo     = db_connect();
    $id      = (int)($_POST['comment_id'] ?? 0);
    $mod     = $_POST['moderation'] ?? '';

    if ($mod === 'delete') {
        $pdo->prepare("DELETE FROM blog_comments WHERE id = ?")->execute([$id]);
    } elseif (in_array($mod, ['approve', 'spam'], true)) {
        $pdo->prepare("UPDATE blog_comments SET status = ? WHERE id = ?")->execute([$mod, $id]);
    }
    json_response(['ok' => true]);
}

json_response(['error' => 'Bad request'], 400);
