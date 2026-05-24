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
