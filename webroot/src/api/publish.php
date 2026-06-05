<?php
declare(strict_types=1);

// Remote publish endpoint — authenticated via APP_SECRET token
// Called by the Claude skill to publish generated blog posts

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$token    = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
$expected = getenv('APP_SECRET') ?: '';

if (!$token || !$expected || !hash_equals($expected, $token)) {
    json_response(['error' => 'Unauthorized'], 401);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    json_response(['error' => 'Invalid JSON body'], 400);
}

$title    = trim($data['title']       ?? '');
$content  = trim($data['content']     ?? '');
$excerpt  = trim($data['excerpt']     ?? '');
$category = trim($data['category']    ?? '');
$status   = in_array($data['status'] ?? '', ['draft', 'published']) ? $data['status'] : 'published';

if (!$title || !$content) {
    json_response(['error' => 'title and content are required'], 400);
}

$pdo  = db_connect();
$slug = sanitize_slug($title);

// Ensure slug is unique
$base_slug  = $slug;
$i          = 1;
$slug_check = $pdo->prepare("SELECT id FROM blog_posts WHERE slug = ?");
$slug_check->execute([$slug]);
while ($slug_check->fetch()) {
    $slug = $base_slug . '-' . $i++;
    $slug_check->execute([$slug]);
}

// Resolve category
$cat_id = null;
if ($category) {
    $stmt = $pdo->prepare("SELECT id FROM blog_categories WHERE name = ? OR slug = ?");
    $stmt->execute([$category, sanitize_slug($category)]);
    $cat = $stmt->fetch();
    $cat_id = $cat['id'] ?? null;
}

$pub_at = $status === 'published' ? date('Y-m-d H:i:s') : null;

$stmt = $pdo->prepare(
    "INSERT INTO blog_posts (title, slug, excerpt, content, author, category_id, status, published_at)
     VALUES (?, ?, ?, ?, 'Jeremy', ?, ?, ?)"
);
$stmt->execute([$title, $slug, $excerpt, $content, $cat_id, $status, $pub_at]);
$id = $pdo->lastInsertId();

// Trigger RAG re-index when post is published
if ($status === 'published') {
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

json_response([
    'ok'   => true,
    'id'   => (int)$id,
    'slug' => $slug,
    'url'  => 'https://my.datadinosaur.com/blog/' . $slug,
]);
