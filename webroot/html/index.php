<?php
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));
define('SRC_ROOT', APP_ROOT . '/src');

session_start([
    'cookie_httponly' => true,
    'cookie_secure'   => isset($_SERVER['HTTPS']),
    'cookie_samesite' => 'Strict',
    'use_strict_mode' => true,
]);

// Autoload & config
require_once APP_ROOT . '/vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

$config = Yaml::parseFile(APP_ROOT . '/config.yaml');

// Load helpers
require_once SRC_ROOT . '/functions/func__db.php';
require_once SRC_ROOT . '/functions/func__auth.php';
require_once SRC_ROOT . '/functions/func__security.php';
require_once SRC_ROOT . '/functions/func__blog.php';
require_once SRC_ROOT . '/functions/func__mail.php';

// Security headers (supplement nginx headers for PHP-served pages)
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

// Parse request path
$raw_path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path     = trim($raw_path, '/');
$segments = array_values(array_filter(explode('/', $path), 'strlen'));

$page   = $segments[0] ?? 'home';
$action = $segments[1] ?? null;
$param  = $segments[2] ?? null;

// --- Sitemap (before API/page routing so it exits cleanly) ---
if ($page === 'sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $base   = rtrim($config['site']['base_url'], '/');
    $posts  = db_connect()
        ->query("SELECT slug, updated_at, published_at FROM blog_posts
                 WHERE status='published' AND visible=1
                 ORDER BY published_at DESC")
        ->fetchAll(PDO::FETCH_ASSOC);
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    $static = [
        ['loc' => '/',         'priority' => '1.0', 'changefreq' => 'weekly' ],
        ['loc' => '/blog',     'priority' => '0.9', 'changefreq' => 'daily'  ],
        ['loc' => '/services', 'priority' => '0.8', 'changefreq' => 'monthly'],
        ['loc' => '/contact',  'priority' => '0.7', 'changefreq' => 'monthly'],
    ];
    foreach ($static as $s) {
        echo "  <url>\n";
        echo "    <loc>" . htmlspecialchars($base . $s['loc']) . "</loc>\n";
        echo "    <changefreq>{$s['changefreq']}</changefreq>\n";
        echo "    <priority>{$s['priority']}</priority>\n";
        echo "  </url>\n";
    }
    foreach ($posts as $p) {
        $lastmod = date('Y-m-d', strtotime($p['updated_at'] ?: $p['published_at']));
        echo "  <url>\n";
        echo "    <loc>" . htmlspecialchars($base . '/blog/' . $p['slug']) . "</loc>\n";
        echo "    <lastmod>{$lastmod}</lastmod>\n";
        echo "    <changefreq>monthly</changefreq>\n";
        echo "    <priority>0.6</priority>\n";
        echo "  </url>\n";
    }
    echo '</urlset>';
    exit;
}

// --- API routes (return JSON, no layout) ---
if ($page === 'api' && $action !== null) {
    $endpoint = preg_replace('/[^a-z_-]/', '', strtolower($action));
    $file     = SRC_ROOT . '/api/' . $endpoint . '.php';
    if (is_file($file)) {
        require $file;
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
    }
    exit;
}

// --- SEO defaults (page files may override before header renders) ---
$base_url        = rtrim($config['site']['base_url'], '/');
$canonical_url   = $base_url . $raw_path;
$meta_desc       = $config['site']['description'];
$og_title        = $config['site']['name'];
$og_type         = 'website';
$og_image        = $base_url . '/assets/images/data_dinosaur_og.png';
$seo_noindex     = false;
$json_ld         = null;

// --- Page routes ---
$page_title = $config['site']['name'];
$body_class = 'page-' . preg_replace('/[^a-z0-9-]/', '', $page ?: 'home');

ob_start();
switch ($page) {
    case '':
    case 'home':
        $page_title = $config['site']['name'] . ' — ' . $config['site']['tagline'];
        $og_title   = $config['site']['name'] . ' — ' . $config['site']['tagline'];
        require SRC_ROOT . '/app/home/index.php';
        break;

    case 'blog':
        if ($action === 'new' || $action === 'edit') {
            require_admin();
            $page_title  = ($action === 'new' ? 'New Post' : 'Edit Post') . ' — ' . $config['site']['name'];
            $seo_noindex = true;
            require SRC_ROOT . '/app/blog/edit.php';
        } elseif ($action !== null) {
            $slug = preg_replace('/[^a-z0-9-]/', '', $action);
            $page_title = 'Blog — ' . $config['site']['name'];
            require SRC_ROOT . '/app/blog/post.php';
        } else {
            $page_title = 'Blog — ' . $config['site']['name'];
            $og_title   = 'Blog — ' . $config['site']['name'];
            require SRC_ROOT . '/app/blog/index.php';
        }
        break;

    case 'services':
        $page_title  = 'Consulting Services — ' . $config['site']['name'];
        $og_title    = 'Consulting Services — ' . $config['site']['name'];
        $meta_desc   = 'Data architecture, governance, AI integration, and data quality consulting by Jeremy at DataDinosaur.';
        require SRC_ROOT . '/app/services/index.php';
        break;

    case 'contact':
        $page_title  = 'Contact — ' . $config['site']['name'];
        $og_title    = 'Contact DataDinosaur';
        $meta_desc   = 'Get in touch with Jeremy at DataDinosaur for data engineering consulting on architecture, governance, and AI integration.';
        require SRC_ROOT . '/app/contact/index.php';
        break;

    case 'brain-breaks':
        $page_title  = 'Brain Breaks — ' . $config['site']['name'];
        $og_title    = 'Brain Breaks — ' . $config['site']['name'];
        $meta_desc   = 'Little games and brain exercises from DataDinosaur — a break from the data and AI grind. First up: Kana Sensei, a Japanese kana trainer.';
        require SRC_ROOT . '/app/brain-breaks/index.php';
        break;

    case 'admin':
        require_admin();
        $seo_noindex = true;
        if ($action === 'rag-eval') {
            $page_title = 'RAG Eval — ' . $config['site']['name'];
            require SRC_ROOT . '/app/admin/rag-eval.php';
        } else {
            $page_title  = 'Admin Dashboard — ' . $config['site']['name'];
            require SRC_ROOT . '/app/admin/dashboard.php';
        }
        break;

    default:
        http_response_code(404);
        $page_title  = '404 — ' . $config['site']['name'];
        $seo_noindex = true;
        require SRC_ROOT . '/app/404.php';
}
$page_content = ob_get_clean();

// Render layout
require SRC_ROOT . '/layout/header.php';
echo $page_content;
require SRC_ROOT . '/layout/footer.php';
