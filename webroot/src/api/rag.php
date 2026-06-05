<?php
declare(strict_types=1);

/**
 * RAG proxy — forwards /api/rag requests to the Python RAG service.
 * Only POST /api/rag/ask and POST /api/rag/ingest are handled.
 */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$rag_secret = getenv('RAG_SECRET') ?: '';
$rag_url    = getenv('RAG_URL') ?: 'http://rag:8000';

// Route: /api/rag/ask  or  /api/rag/ingest
global $param;   // set by front controller: segments[2]
$action = $param ?? '';

if ($action === 'ask') {
    // Rate-limit: 10 req/min per IP (simple, stateless via session)
    $ip_key = 'rag_req_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    $now    = time();
    $window = $_SESSION[$ip_key . '_window'] ?? 0;
    $count  = $_SESSION[$ip_key . '_count']  ?? 0;

    if ($now - $window > 60) {
        $_SESSION[$ip_key . '_window'] = $now;
        $_SESSION[$ip_key . '_count']  = 1;
    } elseif ($count >= 10) {
        json_response(['error' => 'Too many requests. Please wait a moment.'], 429);
    } else {
        $_SESSION[$ip_key . '_count'] = $count + 1;
    }

    $body = file_get_contents('php://input');
    $data = json_decode($body, true);
    $q    = trim($data['question'] ?? '');

    if (!$q) {
        json_response(['error' => 'question is required'], 400);
    }

    $result = rag_request($rag_url . '/ask', ['question' => $q], $rag_secret);
    json_response($result['body'], $result['status']);

} elseif ($action === 'ingest') {
    // Admin-only
    require_admin();
    $result = rag_request($rag_url . '/ingest', [], $rag_secret);
    json_response($result['body'], $result['status']);

} else {
    json_response(['error' => 'Not found'], 404);
}

// ── Helper ────────────────────────────────────────────────────────────────────

function rag_request(string $url, array $payload, string $secret): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Rag-Secret: ' . $secret,
        ],
        CURLOPT_TIMEOUT        => 30,
    ]);

    $raw    = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($err || !$raw) {
        return ['status' => 502, 'body' => ['error' => 'RAG service unavailable']];
    }

    $decoded = json_decode($raw, true);
    return ['status' => $status ?: 502, 'body' => $decoded ?? ['error' => 'Bad response']];
}
