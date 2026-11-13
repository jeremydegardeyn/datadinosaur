<?php
// RSS 2.0 feed of the newest 20 posts, full content. Served at /feed.xml
// (also /feed and /rss.xml, the paths feed readers try first).
declare(strict_types=1);

header('Content-Type: application/rss+xml; charset=utf-8');
header('Cache-Control: public, max-age=900');

$base  = rtrim($config['site']['base_url'], '/');
$posts = db_connect()->query(
    "SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.author, p.published_at,
            p.content_updated_at, c.name AS category_name
     FROM blog_posts p
     LEFT JOIN blog_categories c ON c.id = p.category_id
     WHERE p.status = 'published' AND p.visible = 1
     ORDER BY p.published_at DESC
     LIMIT 20"
)->fetchAll();

$x = fn (string $s): string => htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
$cdata = fn (string $s): string => '<![CDATA[' . str_replace(']]>', ']]]]><![CDATA[>', $s) . ']]>';

$last = $posts ? max(array_map(fn ($p) => strtotime(post_modified_at($p) ?? 'now'), $posts)) : time();

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title><?= $x($config['site']['name']) ?></title>
  <link><?= $x($base) ?>/</link>
  <atom:link href="<?= $x($base) ?>/feed.xml" rel="self" type="application/rss+xml"/>
  <description><?= $x($config['site']['description']) ?></description>
  <language>en-us</language>
  <lastBuildDate><?= date(DATE_RSS, $last) ?></lastBuildDate>
<?php foreach ($posts as $p):
    $url = $base . '/blog/' . $p['slug'];
    // Interactive quizzes can't run in a feed reader; point at the post instead.
    $md = preg_replace(
        '/^:::[ \t]*quiz\b.*?^:::[ \t]*$/ims',
        "\n*This post includes an interactive quiz. [Open the post to take it]({$url}).*\n",
        $p['content']
    );
    $html = render_post_html($md);
    // Feed readers need absolute URLs for images and links.
    $html = preg_replace('#(src|href)="/(?!/)#', '$1="' . $base . '/', $html);
    $desc = $p['excerpt'] ?: auto_excerpt($p['content'], 300);
?>
  <item>
    <title><?= $x($p['title']) ?></title>
    <link><?= $x($url) ?></link>
    <guid isPermaLink="true"><?= $x($url) ?></guid>
    <pubDate><?= date(DATE_RSS, strtotime($p['published_at'])) ?></pubDate>
    <dc:creator><?= $x(author_name($p, $config)) ?></dc:creator>
<?php if (!empty($p['category_name'])): ?>
    <category><?= $x($p['category_name']) ?></category>
<?php endif; ?>
    <description><?= $cdata($desc) ?></description>
    <content:encoded><?= $cdata($html) ?></content:encoded>
  </item>
<?php endforeach; ?>
</channel>
</rss>
