<?php
declare(strict_types=1);

// Email list: double opt-in signup, confirm, unsubscribe, and an admin CSV
// export. Self-hosted so no third-party account is needed; the CSV imports
// into any newsletter tool later.

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$base   = rtrim($config['site']['base_url'], '/');

// ---- Admin: export confirmed subscribers as CSV ----
if ($action === 'export') {
    require_admin();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="datadinosaur-subscribers-' . date('Ymd') . '.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['email', 'confirmed_at', 'source']);
    $rows = db_connect()->query(
        "SELECT email, confirmed_at, source FROM subscribers WHERE status = 'confirmed' ORDER BY confirmed_at"
    );
    foreach ($rows as $r) fputcsv($out, [$r['email'], $r['confirmed_at'], $r['source']]);
    exit;
}

// ---- Confirm (link in the confirmation email) ----
if ($action === 'confirm') {
    $token = preg_replace('/[^a-f0-9]/', '', (string)($_GET['token'] ?? ''));
    if (strlen($token) === 32) {
        db_connect()->prepare(
            "UPDATE subscribers SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, NOW())
             WHERE token = ? AND status <> 'unsubscribed'"
        )->execute([$token]);
    }
    header('Location: /subscribe?confirmed=1');
    exit;
}

// ---- Unsubscribe (link in every email) ----
if ($action === 'unsubscribe') {
    $token = preg_replace('/[^a-f0-9]/', '', (string)($_GET['token'] ?? $_POST['token'] ?? ''));
    if (strlen($token) === 32) {
        db_connect()->prepare(
            "UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = NOW() WHERE token = ?"
        )->execute([$token]);
    }
    // RFC 8058 one-click unsubscribe POSTs and expects a 2xx, not a redirect.
    if ($_SERVER['REQUEST_METHOD'] === 'POST') { http_response_code(200); echo 'Unsubscribed'; exit; }
    header('Location: /subscribe?unsubscribed=1');
    exit;
}

// ---- Signup ----
if ($action !== 'subscribe' || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /subscribe');
    exit;
}

// Same bot traps as the contact form: honeypot field + signed render time.
// Bots get a fake success so they learn nothing.
$fts  = (int)($_POST['ts'] ?? 0);
$fsig = (string)($_POST['tsig'] ?? '');
$fexp = hash_hmac('sha256', (string)$fts, getenv('APP_SECRET') ?: 'dd');
if (!empty($_POST['website']) || !$fts || !hash_equals($fexp, $fsig) || (time() - $fts) < 2) {
    header('Location: /subscribe?pending=1');
    exit;
}
if (!verify_csrf($_POST['csrf_token'] ?? '')) {
    header('Location: /subscribe?error=1');
    exit;
}

$email  = mb_strtolower(trim((string)($_POST['email'] ?? '')));
$source = mb_substr(preg_replace('/[^a-z0-9:._-]/i', '', (string)($_POST['source'] ?? 'site')), 0, 120);
if (!validate_email($email) || mb_strlen($email) > 200) {
    header('Location: /subscribe?error=1');
    exit;
}

$pdo  = db_connect();
$stmt = $pdo->prepare("SELECT token, status, created_at FROM subscribers WHERE email = ?");
$stmt->execute([$email]);
$row  = $stmt->fetch();

if ($row && $row['status'] === 'confirmed') {
    // Already on the list. Same response as a new signup, so the form can't be
    // used to test whether an address is subscribed.
    header('Location: /subscribe?pending=1');
    exit;
}

if ($row) {
    $token = $row['token'];
    // Throttle re-sends to one confirmation email per 10 minutes per address.
    $recent = $pdo->prepare("SELECT 1 FROM subscribers WHERE email = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)");
    $recent->execute([$email]);
    if ($recent->fetch()) { header('Location: /subscribe?pending=1'); exit; }
    $pdo->prepare("UPDATE subscribers SET status = 'pending', source = ?, created_at = NOW(), unsubscribed_at = NULL WHERE email = ?")
        ->execute([$source, $email]);
} else {
    $token = bin2hex(random_bytes(16));
    $pdo->prepare("INSERT INTO subscribers (email, token, status, source) VALUES (?, ?, 'pending', ?)")
        ->execute([$email, $token, $source]);
}

$confirm = $base . '/api/subscribe?action=confirm&token=' . $token;
$unsub   = $base . '/api/subscribe?action=unsubscribe&token=' . $token;
send_site_email(
    $email,
    'Confirm your DataDinosaur subscription',
    "Someone (hopefully you) asked to get new DataDinosaur posts by email.\n\n"
    . "Confirm here:\n{$confirm}\n\n"
    . "Once you confirm, you'll also get a link to the RAG security checklist.\n\n"
    . "If this wasn't you, ignore this email and nothing will be sent.\n\n"
    . "— Jeremy DeGardeyn, DataDinosaur\n{$base}\n",
    ['List-Unsubscribe' => "<{$unsub}>", 'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click']
);

header('Location: /subscribe?pending=1');
exit;
