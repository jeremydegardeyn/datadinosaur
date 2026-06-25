<?php
declare(strict_types=1);

// Anonymous quiz leaderboard. A reader POSTs their finished score; we record
// it (once per session per quiz, so retakes don't inflate the distribution)
// and return the full score histogram so the front-end can show where they
// landed. No identity is stored — only quiz_id, score, and total.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

$data   = json_decode(file_get_contents('php://input'), true) ?: [];
$quizId = preg_replace('/[^a-f0-9]/', '', strtolower((string)($data['quiz_id'] ?? '')));
$total  = (int)($data['total'] ?? 0);
$score  = (int)($data['score'] ?? 0);

if (strlen($quizId) < 8 || $total < 1 || $total > 50 || $score < 0 || $score > $total) {
    json_response(['error' => 'Invalid quiz result'], 400);
}

$pdo = db_connect();
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS quiz_scores (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        quiz_id    VARCHAR(32) NOT NULL,
        score      TINYINT UNSIGNED NOT NULL,
        total      TINYINT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX quiz_idx (quiz_id, total)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

// Count each visitor's attempt at a given quiz once; retakes still see the chart.
$key  = $quizId . ':' . $total;
$seen = $_SESSION['quiz_done'] ?? [];
if (!in_array($key, $seen, true)) {
    $pdo->prepare("INSERT INTO quiz_scores (quiz_id, score, total) VALUES (?, ?, ?)")
        ->execute([$quizId, $score, $total]);
    $seen[] = $key;
    $_SESSION['quiz_done'] = $seen;
}

$stmt = $pdo->prepare(
    "SELECT score, COUNT(*) AS c
     FROM quiz_scores
     WHERE quiz_id = ? AND total = ?
     GROUP BY score"
);
$stmt->execute([$quizId, $total]);

$dist = array_fill(0, $total + 1, 0);
$n    = 0;
foreach ($stmt->fetchAll() as $row) {
    $s = (int)$row['score'];
    if ($s >= 0 && $s <= $total) {
        $dist[$s] = (int)$row['c'];
        $n       += (int)$row['c'];
    }
}

json_response(['ok' => true, 'dist' => $dist, 'count' => $n, 'score' => $score]);
