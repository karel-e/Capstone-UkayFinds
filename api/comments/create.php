<?php
/**
 * POST /api/comments/create.php
 * Body (JSON): { haul_id, body }
 * Adds a comment (1-300 characters) to a published haul. The haul's owner
 * gets a "commented on your haul" notification unless they wrote it.
 * Returns the new comment so the page can show it right away.
 */
require_once __DIR__ . '/../config.php';

const MAX_COMMENT_LENGTH     = 300;
const MAX_COMMENTS_PER_MINUTE = 10;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Log in to comment.', 401);
}
$userId = (int) $_SESSION['user_id'];

$input  = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}
$haulId = isset($input['haul_id']) ? (int) $input['haul_id'] : 0;
$body   = (isset($input['body']) && is_string($input['body'])) ? trim($input['body']) : '';

if ($haulId <= 0) {
    json_error('Invalid request.');
}
if ($body === '') {
    json_error('Write something first.');
}
if (mb_strlen($body) > MAX_COMMENT_LENGTH) {
    json_error('Comments can be up to ' . MAX_COMMENT_LENGTH . ' characters.');
}

$stmt = $pdo->prepare("SELECT user_id FROM hauls WHERE id = ? AND status = 'published'");
$stmt->execute([$haulId]);
$haul = $stmt->fetch();
if (!$haul) {
    json_error('Haul not found.', 404);
}
$ownerId = (int) $haul['user_id'];

// Simple flood guard
$stmt = $pdo->prepare('SELECT COUNT(*) FROM haul_comments WHERE user_id = ? AND created_at > (NOW() - INTERVAL 1 MINUTE)');
$stmt->execute([$userId]);
if ((int) $stmt->fetchColumn() >= MAX_COMMENTS_PER_MINUTE) {
    json_error('Slow down a little — try again in a minute.', 429);
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('INSERT INTO haul_comments (haul_id, user_id, body) VALUES (?, ?, ?)');
    $stmt->execute([$haulId, $userId, $body]);
    $commentId = (int) $pdo->lastInsertId();

    if ($ownerId !== $userId) {
        $stmt = $pdo->prepare(
            "INSERT INTO notifications (recipient_id, actor_id, type, message, location_label, target_type, target_id)
             VALUES (?, ?, 'comment', 'commented on your haul', ?, 'haul', ?)"
        );
        $stmt->execute([$ownerId, $userId, mb_substr($body, 0, 60), $haulId]);
    }
    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('comments/create.php: ' . $e->getMessage());
    json_error('Could not post your comment.', 500);
}

$stmt = $pdo->prepare('SELECT username FROM users WHERE id = ?');
$stmt->execute([$userId]);

json_response([
    'comment' => [
        'id'         => $commentId,
        'body'       => $body,
        'username'   => $stmt->fetchColumn(),
        'created_at' => date('Y-m-d H:i:s'),
        'is_mine'    => true,
    ],
], 201);