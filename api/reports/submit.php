<?php
/**
 * POST /api/reports/submit.php
 * Body (JSON): { target_type: "haul" | "comment", target_id, reason: "spam" | "photo" | "abuse" | "other" }
 * Any logged-in person can report someone else's published haul or comment.
 * One report per person per item; at most MAX_REPORTS_PER_DAY a day.
 */
require_once __DIR__ . '/../config.php';

const MAX_REPORTS_PER_DAY = 20;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

$input  = json_decode(file_get_contents('php://input'), true);
$type   = (is_array($input) && isset($input['target_type'])) ? (string) $input['target_type'] : '';
$tid    = (is_array($input) && isset($input['target_id'])) ? (int) $input['target_id'] : 0;
$reason = (is_array($input) && isset($input['reason'])) ? (string) $input['reason'] : 'other';
if (!in_array($type, ['haul', 'comment'], true) || $tid <= 0) {
    json_error('Invalid request.');
}
if (!in_array($reason, ['spam', 'photo', 'abuse', 'other'], true)) {
    $reason = 'other';
}

if ($type === 'haul') {
    $stmt = $pdo->prepare("SELECT user_id FROM hauls WHERE id = ? AND status = 'published'");
} else {
    $stmt = $pdo->prepare('SELECT user_id FROM haul_comments WHERE id = ?');
}
$stmt->execute([$tid]);
$ownerId = $stmt->fetchColumn();
if ($ownerId === false) {
    json_error('That ' . $type . ' was not found.', 404);
}
if ((int) $ownerId === $userId) {
    json_error('You cannot report your own ' . $type . '.');
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE reporter_id = ? AND created_at > ?');
$stmt->execute([$userId, date('Y-m-d H:i:s', time() - 86400)]);
if ((int) $stmt->fetchColumn() >= MAX_REPORTS_PER_DAY) {
    json_error('You have reached today\'s report limit.', 429);
}

try {
    $pdo->prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)')
        ->execute([$userId, $type, $tid, $reason]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        json_error('You already reported this.', 409);
    }
    throw $e;
}

json_response(['message' => 'Thanks. An admin will take a look.']);