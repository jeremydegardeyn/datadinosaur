#!/usr/bin/env php
<?php
/**
 * Generate bcrypt hash for the admin password.
 * Usage: php scripts/hash-password.php
 *
 * Copy the output hash into your .env as ADMIN_PASSWORD_HASH
 */
if (PHP_SAPI !== 'cli') { exit("Run from CLI only.\n"); }

$password = readline("Enter admin password: ");
if (strlen($password) < 8) { exit("Password must be at least 8 characters.\n"); }

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
echo "\nADMIN_PASSWORD_HASH={$hash}\n\n";
echo "Add the line above to your .env file.\n";
