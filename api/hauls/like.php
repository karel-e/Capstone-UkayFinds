<?php
/**
 * POST /api/hauls/like.php
 * Body (JSON): { haul_id }
 * Toggles the logged-in user's like on a published haul and returns the new
 * state: { liked, like_count }.
 *
 * The owner is notified when a like is ADDED by someone else, and only once
 * per liker per haul: unliking and liking again does not notify again.
 * Needs notifications.target_type / target_id (see the ALTER TABLE in the
 * 5.3 instructions) to recognise "already notified".
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

$input  = json_decode(file_get_contents('php://input'), true);
$haulId = (is_array($input) && isset($input['haul_id'])) ? (int) $input['haul_id'] : 0;
if ($haulId <= 0) {
    json_error('Invalid request.');
}

$stmt = $pdo->prepare("SELECT user_id, item_name FROM hauls WHERE id = ? AND status = 'published'");
$stmt->execute([$haulId]);
$haul = $stmt->fetch();
if (!$haul) {
    json_error('Haul not found.', 404);
}
$ownerId = (int) $haul['user_id'];

$pdo->beginTransaction();
try {
    // Already liked? Then this click is an unlike.
    $stmt = $pdo->prepare('DELETE FROM haul_likes WHERE haul_id = ? AND user_id = ?');
    $stmt->execute([$haulId, $userId]);

    if ($stmt->rowCount() > 0) {
        $liked = false;
    } else {
        // INSERT IGNORE + the unique key means a double-click can't create two rows
        $stmt = $pdo->prepare('INSERT IGNORE INTO haul_likes (haul_id, user_id) VALUES (?, ?)');
        $stmt->execute([$haulId, $userId]);
        $liked = true;

        if ($ownerId !== $userId) {
            $stmt = $pdo->prepare(
                "SELECT id FROM notifications
                  WHERE recipient_id = ? AND actor_id = ? AND type = 'like'
                    AND target_type = 'haul' AND target_id = ?
                  LIMIT 1"
            );
            $stmt->execute([$ownerId, $userId, $haulId]);
            if (!$stmt->fetch()) {
                $stmt = $pdo->prepare(
                    "INSERT INTO notifications (recipient_id, actor_id, type, message, location_label, target_type, target_id)
                     VALUES (?, ?, 'like', 'liked your haul', ?, 'haul', ?)"
                );
                $stmt->execute([$ownerId, $userId, mb_substr((string) $haul['item_name'], 0, 60), $haulId]);
            }
        }
    }
    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    error_log('hauls/like.php: ' . $e->getMessage());
    json_error('Could not save your like.', 500);
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM haul_likes WHERE haul_id = ?');
$stmt->execute([$haulId]);

json_response(['liked' => $liked, 'like_count' => (int) $stmt->fetchColumn()]);