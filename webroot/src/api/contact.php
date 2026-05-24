<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /contact');
    exit;
}

// Honeypot
if (!empty($_POST['website'])) {
    header('Location: /contact?success=1');
    exit;
}

if (!verify_csrf($_POST['csrf_token'] ?? '')) {
    header('Location: /contact?error=1');
    exit;
}

$name    = trim($_POST['name']    ?? '');
$email   = trim($_POST['email']   ?? '');
$company = trim($_POST['company'] ?? '');
$subject = trim($_POST['subject'] ?? '');
$message = trim($_POST['message'] ?? '');
$type    = trim($_POST['type']    ?? 'General Question');

if (!$name || !$email || !$subject || !$message || !validate_email($email)) {
    header('Location: /contact?error=1');
    exit;
}

// Save to DB
$pdo = db_connect();
$pdo->prepare(
    "INSERT INTO contact_inquiries (name, email, company, subject, message, inquiry_type)
     VALUES (?, ?, ?, ?, ?, ?)"
)->execute([$name, $email, $company, $subject, $message, $type]);

// Send email notification
send_contact_email([
    'name'    => $name,
    'email'   => $email,
    'company' => $company,
    'subject' => $subject,
    'message' => $message,
    'type'    => $type,
]);

header('Location: /contact?success=1');
exit;
