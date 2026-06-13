<?php
declare(strict_types=1);

function is_admin(): bool
{
    return isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true;
}

function require_admin(): void
{
    if (!is_admin()) {
        header('Location: /?login=1');
        exit;
    }
}

/**
 * Machine auth: a request carrying a valid X-API-Token header matching
 * APP_SECRET. Used by trusted server-to-server callers (the publish skill,
 * the MCP server) so they can hit admin endpoints without a browser session.
 * Token auth is not cookie-based, so CSRF checks are skipped for these calls.
 */
function is_api_request(): bool
{
    $token    = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
    $expected = getenv('APP_SECRET') ?: '';
    return $token !== '' && $expected !== '' && hash_equals($expected, $token);
}

function admin_login(string $username, string $password): bool
{
    $expected_user = getenv('ADMIN_USERNAME') ?: 'admin';
    $expected_hash = getenv('ADMIN_PASSWORD_HASH') ?: '';

    if ($username !== $expected_user) return false;
    if (!password_verify($password, $expected_hash)) return false;

    session_regenerate_id(true);
    $_SESSION['is_admin'] = true;
    return true;
}

function admin_logout(): void
{
    $_SESSION = [];
    session_destroy();
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf(string $token): bool
{
    return isset($_SESSION['csrf_token']) &&
           hash_equals($_SESSION['csrf_token'], $token);
}
