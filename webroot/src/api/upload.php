<?php
declare(strict_types=1);

// Image upload for the blog editor. Admin session or X-API-Token only.
// Stores under html/assets/uploads/ with a generated name and returns a URL
// to drop into post Markdown as ![alt](url).

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$api = is_api_request();
if (!is_admin() && !$api) json_response(['error' => 'Unauthorized'], 401);
if (!$api && !verify_csrf($_POST['csrf_token'] ?? '')) {
    json_response(['error' => 'Invalid CSRF'], 403);
}

if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    json_response(['error' => 'No file uploaded'], 400);
}

$file     = $_FILES['file'];
$max_size = 5 * 1024 * 1024;   // 5 MB
if ($file['size'] > $max_size) {
    json_response(['error' => 'File too large (max 5 MB)'], 413);
}

// Trust the actual image content, not the client-supplied name or MIME.
$allowed = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG  => 'png',
    IMAGETYPE_GIF  => 'gif',
    IMAGETYPE_WEBP => 'webp',
];
$info = @getimagesize($file['tmp_name']);
if ($info === false || !isset($allowed[$info[2]])) {
    json_response(['error' => 'Unsupported file type (use JPG, PNG, GIF, or WebP)'], 415);
}
$ext = $allowed[$info[2]];

$dir = APP_ROOT . '/html/assets/uploads';
if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
    json_response(['error' => 'Upload directory not writable'], 500);
}

$name = date('Ym') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
$dest = $dir . '/' . $name;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    json_response(['error' => 'Could not save file'], 500);
}
@chmod($dest, 0644);

json_response(['ok' => true, 'url' => '/assets/uploads/' . $name]);
