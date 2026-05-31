<?php
declare(strict_types=1);

// LinkedIn OAuth callback — exchanges auth code for access token and saves it to disk.
// This endpoint is called by LinkedIn after the user approves the OAuth request.

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit('Method not allowed');
}

$code  = $_GET['code']  ?? '';
$error = $_GET['error'] ?? '';

if ($error) {
    http_response_code(400);
    exit(htmlspecialchars('LinkedIn authorization denied: ' . $error));
}

if (!$code) {
    http_response_code(400);
    exit('Missing authorization code');
}

$client_id     = getenv('LINKEDIN_CLIENT_ID')     ?: '';
$client_secret = getenv('LINKEDIN_CLIENT_SECRET') ?: '';
$redirect_uri  = 'https://my.datadinosaur.com/api/linkedin-callback';

if (!$client_id || !$client_secret) {
    http_response_code(500);
    exit('LinkedIn credentials not configured');
}

// Exchange code for access token
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => 'https://www.linkedin.com/oauth/v2/accessToken',
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query([
        'grant_type'    => 'authorization_code',
        'code'          => $code,
        'client_id'     => $client_id,
        'client_secret' => $client_secret,
        'redirect_uri'  => $redirect_uri,
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
]);
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$token_data = json_decode($response, true);

if ($http_code !== 200 || empty($token_data['access_token'])) {
    http_response_code(502);
    exit('Failed to obtain access token: ' . htmlspecialchars($response));
}

// Save token to persistent file readable by the blog-post skill
$token_file = dirname(__DIR__, 2) . '/data/linkedin_token.json';
$payload = json_encode([
    'access_token' => $token_data['access_token'],
    'expires_at'   => time() + (int)($token_data['expires_in'] ?? 5184000),
    'scope'        => $token_data['scope'] ?? '',
    'obtained_at'  => date('c'),
], JSON_PRETTY_PRINT);

if (file_put_contents($token_file, $payload) === false) {
    http_response_code(500);
    exit('Token obtained but failed to save to disk');
}

http_response_code(200);
echo '<!DOCTYPE html><html><head><title>LinkedIn Connected</title></head><body>';
echo '<h2>LinkedIn token refreshed successfully.</h2>';
echo '<p>You can close this tab and re-run the blog post skill.</p>';
echo '</body></html>';
