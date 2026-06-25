<?php
declare(strict_types=1);

/**
 * Render post Markdown to HTML (safe mode) with two image enhancements layered
 * on top of standard Markdown:
 *
 *   Caption — use the image title:   ![alt](url "My caption")
 *             renders the image in a <figure> with a <figcaption>.
 *
 *   Sizing / alignment — append an attribute block:
 *             ![alt](url){width=400}            (pixels)
 *             ![alt](url){width=60%}            (percentage)
 *             ![alt](url "Cap"){width=400,align=center}
 *
 * These are post-processed on Parsedown's output (raw HTML in posts is escaped
 * by safe mode, so we can't inject <figure> from the Markdown directly).
 */
function render_post_html(string $markdown): string
{
    // Quiz blocks are parsed from the RAW Markdown first: their Q:/-/* lines
    // would otherwise be mangled into bullet lists by Parsedown. Pull each one
    // out, leave a plain-text placeholder, and splice the built HTML back in
    // after rendering.
    $quizzes  = [];
    $markdown = preg_replace_callback(
        '/^:::[ \t]*quiz\b(.*?)^:::[ \t]*$/ims',
        function ($m) use (&$quizzes) {
            $token = 'DDQUIZPLACEHOLDER' . count($quizzes) . 'X';
            $quizzes[] = dd_build_quiz($m[1]);
            return "\n\n" . $token . "\n\n";
        },
        $markdown
    );

    $pd = new Parsedown();
    $pd->setSafeMode(true);
    $html = enhance_post_images($pd->text($markdown));

    foreach ($quizzes as $i => $quizHtml) {
        $html = str_replace('<p>DDQUIZPLACEHOLDER' . $i . 'X</p>', $quizHtml, $html);
    }
    return $html;
}

/**
 * Build an interactive multiple-choice quiz from the raw text between the
 * :::quiz markers. One question per `Q:` line; options are `-` (wrong) or `*`
 * (correct); an optional `>` line is the explanation shown after answering.
 * The reader gets immediate per-question feedback (see blog-quiz.js).
 */
function dd_build_quiz(string $raw): string
{
    $questions = [];
    $q = null;
    foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
        $t = trim($line);
        if ($t === '') continue;

        if (preg_match('/^Q[:.)]\s*(.+)$/i', $t, $m)) {
            if ($q) $questions[] = $q;
            $q = ['prompt' => $m[1], 'opts' => [], 'correct' => -1, 'explain' => '', 'oexp' => []];
        } elseif ($q && preg_match('/^\*\s*(.+)$/', $t, $m)) {   // correct option
            $q['correct'] = count($q['opts']);
            $q['opts'][]  = $m[1];
        } elseif ($q && preg_match('/^-\s*(.+)$/', $t, $m)) {    // wrong option
            $q['opts'][]  = $m[1];
        } elseif ($q && preg_match('/^>\s*(.+)$/', $t, $m)) {    // explanation
            // A `>` after an option explains THAT option (shown when it's the
            // picked answer, or the correct one when the reader missed it). A
            // `>` before any option is a general note shown after any answer.
            if ($q['opts']) {
                $q['oexp'][count($q['opts']) - 1] = $m[1];
            } else {
                $q['explain'] = $m[1];
            }
        }
    }
    if ($q) $questions[] = $q;

    // A usable question needs at least two options and a marked answer.
    $questions = array_values(array_filter(
        $questions,
        fn ($x) => count($x['opts']) >= 2 && $x['correct'] >= 0
    ));
    if (!$questions) return '';

    // Stable, anonymous id from the questions themselves, so the leaderboard
    // groups attempts at the same quiz regardless of which post it lives in.
    $sig = '';
    foreach ($questions as $qq) {
        $sig .= $qq['prompt'] . '|' . implode('|', $qq['opts']) . "\n";
    }
    $quizId = substr(sha1($sig), 0, 16);

    $h  = '<div class="dd-quiz" data-count="' . count($questions) . '" data-quiz-id="' . $quizId . '">';
    $h .= '<div class="dd-quiz-head"><span class="dd-quiz-score" aria-live="polite"></span></div>';
    foreach ($questions as $qi => $qq) {
        $h .= '<div class="dd-quiz-q" data-correct="' . $qq['correct'] . '">';
        $h .= '<p class="dd-quiz-prompt"><span class="dd-quiz-num">' . ($qi + 1) . '.</span> '
            . e($qq['prompt']) . '</p>';
        $h .= '<div class="dd-quiz-opts">';
        foreach ($qq['opts'] as $oi => $opt) {
            $h .= '<button type="button" class="dd-quiz-opt" data-i="' . $oi . '">'
                . '<span class="dd-quiz-mark" aria-hidden="true"></span>'
                . '<span class="dd-quiz-text">' . e($opt) . '</span></button>';
        }
        $h .= '</div>';

        // Feedback: per-option explanations (revealed for the picked answer, and
        // for the correct one when missed) plus an optional general note.
        $oexp = array_filter($qq['oexp']);
        if ($oexp || $qq['explain'] !== '') {
            $h .= '<div class="dd-quiz-feedback">';
            foreach ($qq['opts'] as $oi => $opt) {
                if (!empty($qq['oexp'][$oi])) {
                    $h .= '<p class="dd-quiz-opt-explain" data-for="' . $oi . '" hidden>'
                        . e($qq['oexp'][$oi]) . '</p>';
                }
            }
            if ($qq['explain'] !== '') {
                $h .= '<p class="dd-quiz-explain" hidden>' . e($qq['explain']) . '</p>';
            }
            $h .= '</div>';
        }
        $h .= '</div>';
    }

    // Results panel — filled in by blog-quiz.js once every question is answered:
    // a "you scored X / N" line, the anonymous score histogram with the
    // reader's bucket highlighted, and a retake button.
    $h .= '<div class="dd-quiz-results" hidden>'
        . '<p class="dd-quiz-youscored"></p>'
        . '<div class="dd-quiz-hist"></div>'
        . '<p class="dd-quiz-hist-cap"></p>'
        . '<button type="button" class="dd-quiz-retake">Retake quiz</button>'
        . '</div>';

    return $h . '</div>';
}

function enhance_post_images(string $html): string
{
    // 0) Slideshow blocks. Author wraps a run of images between :::slideshow and
    //    ::: markers; we pull the images out and emit one carousel component.
    //    Runs first so the images inside aren't turned into standalone figures.
    //        :::slideshow
    //        ![alt](url1 "Caption 1")
    //        ![alt](url2 "Caption 2")
    //        :::
    $html = preg_replace_callback(
        '#(?:<p>\s*)?:::\s*slideshow\b(.*?):::(?:\s*</p>)?#is',
        fn ($m) => dd_build_slideshow($m[1]),
        $html
    );

    // 1) Image-only paragraphs -> <figure> (with optional caption + sizing).
    $html = preg_replace_callback(
        '#<p>\s*<img\b([^>]*)>\s*(?:\{([^}]*)\})?\s*</p>#i',
        function ($m) {
            [$img, $caption, $style, $class] = dd_img_parts($m[1], $m[2] ?? '');
            $fig = '<figure class="' . $class . '"><img' . $img . $style . '>';
            if ($caption !== '') $fig .= '<figcaption>' . $caption . '</figcaption>';
            return $fig . '</figure>';
        },
        $html
    );

    // 2) Any remaining inline images -> apply sizing in place (no figure).
    $html = preg_replace_callback(
        '#<img\b([^>]*)>\s*(?:\{([^}]*)\})?#i',
        function ($m) {
            [$img, , $style] = dd_img_parts($m[1], $m[2] ?? '');
            return '<img' . $img . $style . '>';
        },
        $html
    );

    return $html;
}

/** Build a slideshow carousel from the HTML between the :::slideshow markers. */
function dd_build_slideshow(string $inner): string
{
    if (!preg_match_all('#<img\b([^>]*)>\s*(?:\{([^}]*)\})?#i', $inner, $ms, PREG_SET_ORDER)) {
        return '';  // no images -> drop the empty block
    }
    $slides = '';
    $dots   = '';
    $n      = count($ms);
    foreach ($ms as $i => $m) {
        [$img, $caption, $style] = dd_img_parts($m[1], $m[2] ?? '');
        $active  = $i === 0 ? ' active' : '';
        $slides .= '<figure class="dd-slide' . $active . '"><img' . $img . $style . '>';
        if ($caption !== '') $slides .= '<figcaption>' . $caption . '</figcaption>';
        $slides .= '</figure>';
        $dots   .= '<button class="dd-slide-dot' . $active . '" type="button" aria-label="Go to slide '
                 . ($i + 1) . '"></button>';
    }
    return '<div class="dd-slideshow" data-count="' . $n . '">'
         . '<div class="dd-slides">' . $slides . '</div>'
         . '<button class="dd-slide-nav dd-slide-prev" type="button" aria-label="Previous slide">&#8249;</button>'
         . '<button class="dd-slide-nav dd-slide-next" type="button" aria-label="Next slide">&#8250;</button>'
         . '<div class="dd-slide-dots">' . $dots . '</div>'
         . '<div class="dd-slide-count"><span class="dd-slide-cur">1</span> / ' . $n . '</div>'
         . '</div>';
}

/** Split an <img> attribute string + {attrs} block into reusable parts. */
function dd_img_parts(string $imgAttrs, string $extra): array
{
    // Pull the title out to use as a caption.
    $caption = '';
    if (preg_match('/\stitle="([^"]*)"/i', $imgAttrs, $tm)) {
        $caption  = $tm[1];
        $imgAttrs = preg_replace('/\stitle="[^"]*"/i', '', $imgAttrs);
    }

    $style = [];
    $class = 'post-image';
    foreach (array_filter(array_map('trim', explode(',', $extra))) as $pair) {
        if (strpos($pair, '=') === false) continue;
        [$k, $v] = array_map('trim', explode('=', $pair, 2));
        $k = strtolower($k);
        if ($k === 'width') {
            $v = preg_match('/^\d{1,4}%$/', $v) ? $v : (int)$v . 'px';
            $style[] = 'width:' . $v;
        } elseif ($k === 'align' && in_array($v, ['left', 'right', 'center'], true)) {
            $class .= ' post-image-' . $v;
        }
    }
    $styleAttr = $style ? ' style="' . implode(';', $style) . '"' : '';
    // Drop a trailing self-closing slash so we can re-emit a clean tag.
    return [rtrim($imgAttrs, " /"), $caption, $styleAttr, $class];
}

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
                   p.category_id, p.views, p.published_at, p.pinned,
                   c.name AS category_name, c.slug AS category_slug
            FROM blog_posts p
            LEFT JOIN blog_categories c ON c.id = p.category_id
            WHERE {$where}
            ORDER BY p.pinned DESC, p.published_at DESC
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
