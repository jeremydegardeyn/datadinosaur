<?php
declare(strict_types=1);

if (!is_admin()) {
    json_response(['error' => 'Unauthorized'], 401);
}

$body    = json_decode(file_get_contents('php://input'), true);
$content = $body['content'] ?? '';

json_response(['html' => render_post_html($content)]);
