<?php
declare(strict_types=1);

// Anonymous cross-user Kana practice leaderboard. A finished Practice session
// of at least MIN answers is recorded as an accuracy %, and the endpoint
// returns the accuracy-bucket histogram (deciles 0..100) so the page can show
// where the player's best session lands among everyone. No identity is stored.
// A request with no `correct` is a read-only peek (returns the distribution
// without recording).

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$data      = json_decode(file_get_contents('php://input'), true) ?: [];
$total     = (int)($data['total'] ?? 0);
$correct   = (int)($data['correct'] ?? 0);
$hasResult = array_key_exists('correct', $data) && $data['correct'] !== null && $data['correct'] !== '';

const KANA_MIN = 10;   // a session must have this many answers to count

if ($hasResult && ($total < KANA_MIN || $correct < 0 || $correct > $total)) {
    json_response(['error' => 'Invalid session'], 400);
}

$pdo = db_connect();
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS kana_sessions (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        accuracy   TINYINT UNSIGNED NOT NULL,   -- 0..100
        correct    SMALLINT UNSIGNED NOT NULL,
        total      SMALLINT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX acc_idx (accuracy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

if ($hasResult) {
    // Light rate-limit so a tab can't spam the table: 20 records/min/session.
    $now = time();
    $w   = $_SESSION['kana_w'] ?? 0;
    $c   = $_SESSION['kana_c'] ?? 0;
    if ($now - $w > 60)      { $_SESSION['kana_w'] = $now; $_SESSION['kana_c'] = 1; }
    elseif ($c >= 20)        { json_response(['error' => 'Too many sessions, slow down.'], 429); }
    else                     { $_SESSION['kana_c'] = $c + 1; }

    $acc = (int) round(100 * $correct / $total);
    $pdo->prepare("INSERT INTO kana_sessions (accuracy, correct, total) VALUES (?, ?, ?)")
        ->execute([$acc, $correct, $total]);
}

// Distribution bucketed into deciles: index 0=0%, 1=10%, … 10=100%.
$stmt = $pdo->query("SELECT ROUND(accuracy / 10) AS b, COUNT(*) AS c FROM kana_sessions GROUP BY b");
$dist = array_fill(0, 11, 0);
$n    = 0;
foreach ($stmt->fetchAll() as $row) {
    $idx = (int) $row['b'];
    if ($idx >= 0 && $idx <= 10) { $dist[$idx] = (int) $row['c']; $n += (int) $row['c']; }
}

json_response(['ok' => true, 'dist' => $dist, 'count' => $n, 'min' => KANA_MIN]);
