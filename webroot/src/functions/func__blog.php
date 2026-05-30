<?php
declare(strict_types=1);

function get_posts(int $page = 1, int $per_page = 8, ?int $category_id = null): array
{
    $pdo    = db_connect();
    $offset = ($page - 1) * $per_page;
    $where  = 'p.status = \'published\' AND p.visible = 1';
    $params = [];

    if ($category_id !== null) {
        $where   .= ' AND p.category_id = :cat';
        $params[':cat'] = $category_id;
    }

    $sql = "SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.author,
                   p.category_id, p.views, p.published_at, c.name AS category_name, c.slug AS category_slug
            FROM blog_posts p
            LEFT JOIN blog_categories c ON c.id = p.category_id
            WHERE {$where}
            ORDER BY p.published_at DESC
            LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit',  $per_page, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function count_posts(?int $category_id = null): int
{
    $pdo    = db_connect();
    $where  = 'status = \'published\' AND visible = 1';
    $params = [];
    if ($category_id !== null) {
        $where .= ' AND category_id = :cat';
        $params[':cat'] = $category_id;
    }
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM blog_posts WHERE {$where}");
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->execute();
    return (int)$stmt->fetchColumn();
}

function get_post_by_slug(string $slug): ?array
{
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        "SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM blog_posts p
         LEFT JOIN blog_categories c ON c.id = p.category_id
         WHERE p.slug = ? AND p.status = 'published' AND p.visible = 1"
    );
    $stmt->execute([$slug]);
    $post = $stmt->fetch() ?: null;

    if ($post) {
        // Increment view count
        $pdo->prepare("UPDATE blog_posts SET views = views + 1 WHERE id = ?")
            ->execute([$post['id']]);
    }
    return $post;
}

function get_post_by_id(int $id): ?array
{
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        "SELECT p.*, c.name AS category_name
         FROM blog_posts p
         LEFT JOIN blog_categories c ON c.id = p.category_id
         WHERE p.id = ?"
    );
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function get_comments(int $post_id, bool $approved_only = true): array
{
    $pdo   = db_connect();
    $where = $approved_only ? "AND status = 'approved'" : '';
    $stmt  = $pdo->prepare(
        "SELECT id, author_name, content, created_at
         FROM blog_comments
         WHERE post_id = ? {$where}
         ORDER BY created_at ASC"
    );
    $stmt->execute([$post_id]);
    return $stmt->fetchAll();
}

function add_comment(int $post_id, string $name, string $email, string $content): bool
{
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        "INSERT INTO blog_comments (post_id, author_name, author_email, content, status)
         VALUES (?, ?, ?, ?, 'pending')"
    );
    return $stmt->execute([$post_id, $name, $email, $content]);
}

function search_posts(string $query, int $limit = 10): array
{
    if (strlen(trim($query)) < 3) return [];
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        "SELECT id, title, slug, excerpt, published_at,
                MATCH(title, excerpt, content) AGAINST(:q IN NATURAL LANGUAGE MODE) AS score
         FROM blog_posts
         WHERE status = 'published' AND visible = 1
           AND MATCH(title, excerpt, content) AGAINST(:q2 IN NATURAL LANGUAGE MODE)
         ORDER BY score DESC
         LIMIT :lim"
    );
    $stmt->bindValue(':q',  $query);
    $stmt->bindValue(':q2', $query);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

function get_categories(): array
{
    $pdo  = db_connect();
    $stmt = $pdo->query(
        "SELECT c.id, c.name, c.slug, COUNT(p.id) AS post_count
         FROM blog_categories c
         LEFT JOIN blog_posts p ON p.category_id = c.id AND p.status = 'published' AND p.visible = 1
         GROUP BY c.id
         ORDER BY c.name ASC"
    );
    return $stmt->fetchAll();
}

function get_recent_posts(int $limit = 5): array
{
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        "SELECT id, title, slug, excerpt, content, published_at
         FROM blog_posts
         WHERE status = 'published' AND visible = 1
         ORDER BY published_at DESC
         LIMIT ?"
    );
    $stmt->execute([$limit]);
    return $stmt->fetchAll();
}

function auto_excerpt(string $content, int $length = 200): string
{
    $plain = strip_tags($content);
    if (mb_strlen($plain) <= $length) return $plain;
    return mb_substr($plain, 0, $length) . '…';
}
