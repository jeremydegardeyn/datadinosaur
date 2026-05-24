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

// --- Page routes ---
$page_title = $config['site']['name'];
$body_class = 'page-' . preg_replace('/[^a-z0-9-]/', '', $page ?: 'home');

ob_start();
switch ($page) {
    case '':
    case 'home':
        $page_title = $config['site']['name'] . ' — ' . $config['site']['tagline'];
        require SRC_ROOT . '/app/home/index.php';
        break;

    case 'blog':
        if ($action === 'new' || $action === 'edit') {
            require_admin();
            $page_title = ($action === 'new' ? 'New Post' : 'Edit Post') . ' — ' . $config['site']['name'];
            require SRC_ROOT . '/app/blog/edit.php';
        } elseif ($action !== null) {
            // treat $action as post slug
            $slug = preg_replace('/[^a-z0-9-]/', '', $action);
            $page_title = 'Blog — ' . $config['site']['name'];
            require SRC_ROOT . '/app/blog/post.php';
        } else {
            $page_title = 'Blog — ' . $config['site']['name'];
            require SRC_ROOT . '/app/blog/index.php';
        }
        break;

    case 'services':
        $page_title = 'Consulting Services — ' . $config['site']['name'];
        require SRC_ROOT . '/app/services/index.php';
        break;

    case 'contact':
        $page_title = 'Contact — ' . $config['site']['name'];
        require SRC_ROOT . '/app/contact/index.php';
        break;

    case 'admin':
        require_admin();
        $page_title = 'Admin Dashboard — ' . $config['site']['name'];
        require SRC_ROOT . '/app/admin/dashboard.php';
        break;

    default:
        http_response_code(404);
        $page_title = '404 — ' . $config['site']['name'];
        require SRC_ROOT . '/app/404.php';
}
$page_content = ob_get_clean();

// Render layout
require SRC_ROOT . '/layout/header.php';
echo $page_content;
require SRC_ROOT . '/layout/footer.php';
