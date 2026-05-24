<?php
declare(strict_types=1);

function db_connect(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = getenv('MYSQL_HOST')     ?: 'db';
    $db   = getenv('MYSQL_DATABASE') ?: 'datadinosaur';
    $user = getenv('MYSQL_USER')     ?: 'dduser';
    $pass = getenv('MYSQL_PASSWORD') ?: '';

    $dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}
