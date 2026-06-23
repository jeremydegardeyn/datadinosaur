<?php
declare(strict_types=1);

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Trusted server-to-server caller (MCP server / publish skill). When true,
// admin endpoints are reachable without a session and CSRF is skipped.
$api = is_api_request();

// ---- Admin: list posts (token or session) ----
// Used by the MCP server's list_posts tool. Read-only, returns JSON.
if ($action === 'admin_list') {
    if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);

    $pdo   = db_connect();
    $limit = max(1, min(100, (int)($_GET['limit']  ?? 50)));
    $offset= max(0, (int)($_GET['offset'] ?? 0));
    $stmt  = $pdo->prepare(
        "SELECT id, title, slug, status, visible, pinned, published_at, updated_at, views
         FROM blog_posts ORDER BY published_at DESC LIMIT ? OFFSET ?"
    );
    $stmt->bindValue(1, $limit,  PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows  = $stmt->fetchAll();
    $total = (int)$pdo->query("SELECT COUNT(*) FROM blog_posts")->fetchColumn();
    json_response(['total' => $total, 'limit' => $limit, 'offset' => $offset, 'posts' => $rows]);
}

// ---- Admin: list comments (token or session) ----
// Used by the MCP server so moderate_comment has IDs to act on.
if ($action === 'admin_comments') {
    if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);

    $pdo    = db_connect();
    $status = in_array($_GET['status'] ?? 'pending', ['pending','approved','spam'], true)
            ? $_GET['status'] : 'pending';
    $stmt   = $pdo->prepare(
        "SELECT c.id, c.post_id, p.title AS post_title, p.slug AS post_slug,
                c.author_name, c.author_email, c.content, c.status, c.created_at
         FROM blog_comments c JOIN blog_posts p ON p.id = c.post_id
         WHERE c.status = ? ORDER BY c.created_at DESC LIMIT 100"
    );
    $stmt->execute([$status]);
    json_response(['status' => $status, 'comments' => $stmt->fetchAll()]);
}

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

// ---- API: partial update (token only) ----
// MCP update_post: send only the fields to change. Returns JSON, no redirect.
if ($action === 'update' && $api && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo     = db_connect();
    $post_id = (int)($_POST['post_id'] ?? 0);
    if (!$post_id) json_response(['error' => 'post_id is required'], 400);

    $stmt = $pdo->prepare("SELECT * FROM blog_posts WHERE id = ?");
    $stmt->execute([$post_id]);
    $current = $stmt->fetch();
    if (!$current) json_response(['error' => 'Post not found'], 404);

    $allowed = ['title','slug','excerpt','content','category_id','status','pinned','visible'];
    $sets    = [];
    $vals    = [];
    foreach ($allowed as $f) {
        if (!array_key_exists($f, $_POST)) continue;
        $v = $_POST[$f];
        if ($f === 'status' && !in_array($v, ['draft','published'], true)) {
            json_response(['error' => "invalid status"], 400);
        }
        if (in_array($f, ['pinned','visible'], true))  $v = (int)(bool)(int)$v;
        if ($f === 'category_id') $v = $v === '' ? null : (int)$v;
        $sets[] = "$f = ?";
        $vals[] = $v;
    }
    if (!$sets) json_response(['error' => 'no fields to update'], 400);

    // Stamp published_at the first time a post flips to published.
    $new_status = $_POST['status'] ?? $current['status'];
    if ($new_status === 'published' && $current['status'] !== 'published') {
        $sets[] = "published_at = NOW()";
    }
    $sets[] = "updated_at = NOW()";

    $vals[] = $post_id;
    $pdo->prepare("UPDATE blog_posts SET " . implode(', ', $sets) . " WHERE id = ?")
        ->execute($vals);

    // Keep the RAG index in sync — edits to a published post change its text
    // (including image alt text), so re-index just as publish.php does on create.
    if ($new_status === 'published') {
        $rag_url    = getenv('RAG_URL') ?: 'http://rag:8000';
        $rag_secret = getenv('RAG_SECRET') ?: '';
        $ch = curl_init($rag_url . '/ingest');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => '{}',
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'X-Rag-Secret: ' . $rag_secret,
            ],
            CURLOPT_TIMEOUT => 10,
        ]);
        curl_exec($ch);   // fire-and-forget; ignore errors
        curl_close($ch);
    }

    $slug = $_POST['slug'] ?? $current['slug'];
    json_response([
        'ok'   => true,
        'id'   => $post_id,
        'slug' => $slug,
        'url'  => 'https://my.datadinosaur.com/blog/' . $slug,
    ]);
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
    $pinned      = isset($_POST['pinned'])  ? 1 : 0;
    $visible     = isset($_POST['visible']) ? 1 : 0;
    $slug        = $slug_input ?: sanitize_slug($title);

    if (!$title || !$content) {
        header('Location: /blog/new?error=missing_fields');
        exit;
    }

    if ($action === 'create') {
        $stmt = $pdo->prepare(
            "INSERT INTO blog_posts (title, slug, excerpt, content, author, category_id, status, pinned, visible, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $pub = $status === 'published' ? date('Y-m-d H:i:s') : null;
        $stmt->execute([$title, $slug, $excerpt, $content, 'Jeremy', $category_id, $status, $pinned, $visible, $pub]);
        $new_id = (int)$pdo->lastInsertId();
        header('Location: /blog/edit?id=' . $new_id . '&saved=1');
        exit;
    }

    // update
    $post_id = (int)($_POST['post_id'] ?? 0);
    $stmt = $pdo->prepare(
        "UPDATE blog_posts
         SET title=?, slug=?, excerpt=?, content=?, category_id=?, status=?, pinned=?, visible=?,
             published_at = CASE WHEN status != 'published' AND ? = 'published'
                                 THEN NOW() ELSE published_at END,
             updated_at   = NOW()
         WHERE id = ?"
    );
    $stmt->execute([$title, $slug, $excerpt, $content, $category_id, $status, $pinned, $visible, $status, $post_id]);
    header('Location: /blog/edit?id=' . $post_id . '&saved=1');
    exit;
}

// ---- Admin: toggle post visibility ----
if ($action === 'toggle_visibility' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);
    if (!$api && !verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo     = db_connect();
    $post_id = (int)($_POST['post_id'] ?? 0);
    $visible = (int)(bool)((int)($_POST['visible'] ?? 1));
    $pdo->prepare("UPDATE blog_posts SET visible = ?, updated_at = NOW() WHERE id = ?")
        ->execute([$visible, $post_id]);
    json_response(['ok' => true]);
}

// ---- Admin: toggle post pin ----
if ($action === 'toggle_pin' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);
    if (!$api && !verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo     = db_connect();
    $post_id = (int)($_POST['post_id'] ?? 0);
    $pinned  = (int)(bool)((int)($_POST['pinned'] ?? 0));
    $pdo->prepare("UPDATE blog_posts SET pinned = ?, updated_at = NOW() WHERE id = ?")
        ->execute([$pinned, $post_id]);
    json_response(['ok' => true, 'pinned' => $pinned]);
}

// ---- Admin: delete post ----
if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);
    if (!$api && !verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo = db_connect();
    $pdo->prepare("DELETE FROM blog_posts WHERE id = ?")->execute([(int)$_POST['post_id']]);
    json_response(['ok' => true]);
}

// ---- Admin: moderate comment ----
if ($action === 'moderate_comment' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);
    if (!$api && !verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

    $pdo     = db_connect();
    $id      = (int)($_POST['comment_id'] ?? 0);
    $mod     = $_POST['moderation'] ?? '';

    if ($mod === 'delete') {
        $pdo->prepare("DELETE FROM blog_comments WHERE id = ?")->execute([$id]);
    } elseif ($mod === 'approve') {
        $pdo->prepare("UPDATE blog_comments SET status = 'approved' WHERE id = ?")->execute([$id]);
    } elseif ($mod === 'spam') {
        $pdo->prepare("UPDATE blog_comments SET status = 'spam' WHERE id = ?")->execute([$id]);
    }
    json_response(['ok' => true]);
}

json_response(['error' => 'Bad request'], 400);
