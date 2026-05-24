<?php
declare(strict_types=1);

if (!is_admin()) {
    json_response(['error' => 'Unauthorized'], 401);
}

$body    = json_decode(file_get_contents('php://input'), true);
$content = $body['content'] ?? '';

$parsedown = new Parsedown();
$parsedown->setSafeMode(true);

json_response(['html' => $parsedown->text($content)]);
