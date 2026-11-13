<?php
// /llms.txt — a plain-text map of the site for AI assistants and answer
// engines (https://llmstxt.org). Generated so it never goes stale.
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=3600');

$base = rtrim($config['site']['base_url'], '/');
$pdo  = db_connect();

$top = $pdo->query(
    "SELECT title, slug, excerpt FROM blog_posts
     WHERE status = 'published' AND visible = 1
     ORDER BY views DESC LIMIT 10"
)->fetchAll();

$recent = $pdo->query(
    "SELECT title, slug, excerpt FROM blog_posts
     WHERE status = 'published' AND visible = 1
     ORDER BY published_at DESC LIMIT 10"
)->fetchAll();

$line = fn (array $p): string =>
    '- [' . $p['title'] . '](' . $base . '/blog/' . $p['slug'] . ')'
    . ($p['excerpt'] ? ': ' . preg_replace('/\s+/', ' ', trim($p['excerpt'])) : '');

$out   = [];
$out[] = '# ' . $config['site']['name'];
$out[] = '';
$out[] = '> ' . $config['site']['description'];
$out[] = '';
$out[] = 'DataDinosaur is written by ' . $config['site']['author'] . ', a data and AI architect with over 20 years in IT and data. '
       . 'Most posts report on working builds on Google Cloud and AWS: what was built, what was measured, and what was not tested. '
       . 'Topics: AI gateways and agent governance, MCP, LLM evaluation, RAG security, data governance and catalogs, and data pipelines (Dataflow/Beam, BigQuery, Iceberg).';
$out[] = '';
$out[] = '## Start here';
$out[] = '- [Start here](' . $base . '/start-here): who the site is for and where to begin';
$out[] = '- [All posts](' . $base . '/blog)';
$out[] = '- [RSS feed](' . $base . '/feed.xml)';
$out[] = '';

$series = get_all_series();
if ($series) {
    $out[] = '## Series';
    foreach ($series as $s) {
        $out[] = '- [' . $s['name'] . '](' . $base . '/series/' . series_slug($s['name']) . '): ' . (int)$s['post_count'] . ' posts in reading order';
    }
    $out[] = '';
}

$out[] = '## Most-read posts';
foreach ($top as $p) $out[] = $line($p);
$out[] = '';
$out[] = '## Recent posts';
foreach ($recent as $p) $out[] = $line($p);
$out[] = '';
$out[] = '## Other';
$out[] = '- [Consulting services](' . $base . '/services)';
$out[] = '- [About the author](' . $base . '/about)';
$out[] = '- [RAG security checklist](' . $base . '/resources/rag-security-checklist)';
$out[] = '- [Brain Breaks](' . $base . '/brain-breaks): small browser games, including Guardrail Gauntlet, an AI gateway arcade game';

echo implode("\n", $out) . "\n";
