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

/** A run of `>` notes followed by another option are per-option explanations
 *  (each attaches to the option it directly follows). */
function dd_quiz_resolve_sandwiched(array &$q, array &$pending): void
{
    foreach ($pending as $p) {
        if ($p['after'] >= 0) $q['oexp'][$p['after']] = $p['text'];
        else                  $q['explain'] = $p['text'];   // note before any option
    }
    $pending = [];
}

/** `>` notes after the last option are a general note shown after any answer —
 *  unless the question already has per-option notes, in which case a trailing
 *  note belongs to that last option. This lets authors write either one
 *  explanation after all the options OR a note under each option. */
function dd_quiz_resolve_trailing(array &$q, array &$pending): void
{
    $hasPerOption = (bool) array_filter($q['oexp']);
    foreach ($pending as $p) {
        if ($p['after'] < 0)   $q['explain'] = $p['text'];
        elseif ($hasPerOption) $q['oexp'][$p['after']] = $p['text'];
        else                   $q['explain'] = $p['text'];
    }
    $pending = [];
}

/** Render an explanation line: escape it, but turn [label](http…) Markdown
 *  links into anchors. Blog content is single-author and trusted. */
function dd_quiz_explain_html(string $text): string
{
    $out = '';
    $offset = 0;
    if (preg_match_all('/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/', $text, $mm, PREG_OFFSET_CAPTURE | PREG_SET_ORDER)) {
        foreach ($mm as $m) {
            $pos  = $m[0][1];
            $out .= e(substr($text, $offset, $pos - $offset));
            $out .= '<a href="' . e($m[2][0]) . '" target="_blank" rel="noopener noreferrer">'
                  . e($m[1][0]) . '</a>';
            $offset = $pos + strlen($m[0][0]);
        }
    }
    return $out . e(substr($text, $offset));
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
    $pending = [];   // `>` notes awaiting resolution (per-option vs general)
    foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
        $t = trim($line);
        if ($t === '') continue;

        if (preg_match('/^Q[:.)]\s*(.+)$/i', $t, $m)) {
            if ($q) { dd_quiz_resolve_trailing($q, $pending); $questions[] = $q; }
            $q = ['prompt' => $m[1], 'opts' => [], 'correct' => -1, 'explain' => '', 'oexp' => []];
            $pending = [];
        } elseif ($q && preg_match('/^\*\s*(.+)$/', $t, $m)) {   // correct option
            dd_quiz_resolve_sandwiched($q, $pending);
            $q['correct'] = count($q['opts']);
            $q['opts'][]  = $m[1];
        } elseif ($q && preg_match('/^-\s*(.+)$/', $t, $m)) {    // wrong option
            dd_quiz_resolve_sandwiched($q, $pending);
            $q['opts'][]  = $m[1];
        } elseif ($q && preg_match('/^>\s*(.+)$/', $t, $m)) {    // explanation
            // Resolved later: a note with another option after it is per-option;
            // a note after the last option is a general note (see helpers below).
            $pending[] = ['after' => count($q['opts']) - 1, 'text' => $m[1]];
        }
    }
    if ($q) { dd_quiz_resolve_trailing($q, $pending); $questions[] = $q; }

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
                        . dd_quiz_explain_html($qq['oexp'][$oi]) . '</p>';
                }
            }
            if ($qq['explain'] !== '') {
                $h .= '<p class="dd-quiz-explain" hidden>' . dd_quiz_explain_html($qq['explain']) . '</p>';
            }
            $h .= '</div>';
        }
        $h .= '</div>';
    }

    // Results panel — filled in by blog-quiz.js once every question is answered:
    // a "you scored X / N" line, the anonymous score histogram with the
    // reader's bucket highlighted, and a retake button.
    $h .= '<div class="dd-quiz-results" hidden>'
        . '<p class="dd-quiz-hist-title">Score distribution</p>'
        . '<p class="dd-quiz-youscored" hidden></p>'
        . '<div class="dd-quiz-hist"></div>'
        . '<p class="dd-quiz-hist-cap"></p>'
        . '<button type="button" class="dd-quiz-retake" hidden>Retake quiz</button>'
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
    $imgAttrs = rtrim($imgAttrs, " /");

    // Performance: lazy-load and decode off the main thread, and give the
    // browser intrinsic dimensions for local uploads so the layout doesn't
    // jump as images arrive.
    if (stripos($imgAttrs, 'loading=') === false)  $imgAttrs .= ' loading="lazy"';
    if (stripos($imgAttrs, 'decoding=') === false) $imgAttrs .= ' decoding="async"';
    if (stripos($imgAttrs, ' width=') === false
        && preg_match('#\ssrc="(/assets/(?:uploads|images)/[A-Za-z0-9._-]+)"#', $imgAttrs, $sm)) {
        $dims = dd_local_image_size($sm[1]);
        if ($dims) $imgAttrs .= ' width="' . $dims[0] . '" height="' . $dims[1] . '"';
    }
    return [$imgAttrs, $caption, $styleAttr, $class];
}

/** Intrinsic [width, height] of a file under html/, or null. */
function dd_local_image_size(string $webPath): ?array
{
    static $cache = [];
    if (array_key_exists($webPath, $cache)) return $cache[$webPath];
    $file = APP_ROOT . '/html' . $webPath;
    $info = is_file($file) ? @getimagesize($file) : false;
    return $cache[$webPath] = $info ? [(int)$info[0], (int)$info[1]] : null;
}

/**
 * Give every H2/H3 in rendered post HTML a stable id and a hover anchor link,
 * and return the list of H2s for the table of contents.
 *
 * @return array{0:string,1:array<int,array{id:string,text:string}>}
 */
function dd_add_heading_anchors(string $html): array
{
    $toc  = [];
    $used = [];
    $html = preg_replace_callback(
        '#<(h[23])>(.*?)</\1>#is',
        function ($m) use (&$toc, &$used) {
            $text = trim(html_entity_decode(strip_tags($m[2]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $id   = sanitize_slug($text) ?: 'section';
            $base = $id;
            $n    = 2;
            while (isset($used[$id])) $id = $base . '-' . $n++;
            $used[$id] = true;
            if (strtolower($m[1]) === 'h2') $toc[] = ['id' => $id, 'text' => $text];
            return '<' . $m[1] . ' id="' . $id . '">' . $m[2]
                 . '<a class="heading-anchor" href="#' . $id . '" aria-label="Link to this section">#</a>'
                 . '</' . $m[1] . '>';
        },
        $html
    );
    return [$html, $toc];
}

/** True if any reader-visible text field in $incoming differs from $current. */
function dd_words_changed(array $current, array $incoming): bool
{
    foreach (['title', 'excerpt', 'summary', 'content'] as $f) {
        if (!array_key_exists($f, $incoming)) continue;
        if (trim((string)($incoming[$f] ?? '')) !== trim((string)($current[$f] ?? ''))) return true;
    }
    return false;
}

/** The date a post's words last changed (falls back to publish date). */
function post_modified_at(array $post): ?string
{
    $d = $post['content_updated_at'] ?? null;
    return $d ?: ($post['published_at'] ?? null);
}

/** URL slug for a series name. */
function series_slug(string $name): string
{
    return sanitize_slug($name);
}

/** Posts in one series, in reading order. */
function get_series_posts(string $series): array
{
    $stmt = db_connect()->prepare(
        "SELECT id, title, slug, excerpt, content, published_at, series_order
         FROM blog_posts
         WHERE series = ? AND status = 'published' AND visible = 1
         ORDER BY COALESCE(series_order, 9999), published_at ASC"
    );
    $stmt->execute([$series]);
    return $stmt->fetchAll();
}

/** All series with post counts, largest first. */
function get_all_series(): array
{
    return db_connect()->query(
        "SELECT series AS name, COUNT(*) AS post_count, MAX(published_at) AS latest
         FROM blog_posts
         WHERE series IS NOT NULL AND series <> '' AND status = 'published' AND visible = 1
         GROUP BY series
         ORDER BY post_count DESC, latest DESC"
    )->fetchAll();
}

/** Find a series name from its URL slug. */
function find_series_by_slug(string $slug): ?string
{
    foreach (get_all_series() as $s) {
        if (series_slug($s['name']) === $slug) return $s['name'];
    }
    return null;
}

/**
 * Up to $limit related posts: same series first, then same category, then
 * newest. Never the post itself.
 */
function get_related_posts(array $post, int $limit = 3): array
{
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        "SELECT id, title, slug, excerpt, content, published_at
         FROM blog_posts
         WHERE id <> :id AND status = 'published' AND visible = 1
         ORDER BY (series IS NOT NULL AND series = :series) DESC,
                  (category_id IS NOT NULL AND category_id = :cat) DESC,
                  published_at DESC
         LIMIT :lim"
    );
    $stmt->bindValue(':id', (int)$post['id'], PDO::PARAM_INT);
    $stmt->bindValue(':series', (string)($post['series'] ?? ''));
    $stmt->bindValue(':cat', (int)($post['category_id'] ?? 0), PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll();
}

/** Look up several published posts by slug, preserving the given order. */
function get_posts_by_slugs(array $slugs): array
{
    if (!$slugs) return [];
    $in   = implode(',', array_fill(0, count($slugs), '?'));
    $stmt = db_connect()->prepare(
        "SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.published_at, c.name AS category_name
         FROM blog_posts p LEFT JOIN blog_categories c ON c.id = p.category_id
         WHERE p.slug IN ($in) AND p.status = 'published' AND p.visible = 1"
    );
    $stmt->execute(array_values($slugs));
    $by = [];
    foreach ($stmt->fetchAll() as $r) $by[$r['slug']] = $r;
    return array_values(array_filter(array_map(fn ($s) => $by[$s] ?? null, $slugs)));
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
        // Increment view count. `updated_at = updated_at` stops the column's
        // ON UPDATE CURRENT_TIMESTAMP from firing — without it every page view
        // stamped the post as modified now.
        $pdo->prepare("UPDATE blog_posts SET views = views + 1, updated_at = updated_at WHERE id = ?")
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

/** Categories with published-post counts. Public pages hide empty ones;
 *  the editor passes false so every category is selectable. */
function get_categories(bool $only_used = true): array
{
    $pdo    = db_connect();
    $having = $only_used ? 'HAVING post_count > 0' : '';
    $stmt   = $pdo->query(
        "SELECT c.id, c.name, c.slug, COUNT(p.id) AS post_count
         FROM blog_categories c
         LEFT JOIN blog_posts p ON p.category_id = c.id AND p.status = 'published' AND p.visible = 1
         GROUP BY c.id
         {$having}
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
