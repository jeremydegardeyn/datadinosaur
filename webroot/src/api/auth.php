<?php
declare(strict_types=1);

header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'logout') {
    admin_logout();
    header('Location: /');
    exit;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? '')) {
        json_response(['error' => 'Invalid request'], 403);
    }

    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (admin_login($username, $password)) {
        header('Location: /admin');
        exit;
    }

    header('Location: /?login=1&login_error=1');
    exit;
}

json_response(['error' => 'Bad request'], 400);
