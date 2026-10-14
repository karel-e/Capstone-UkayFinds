<?php
/**
 * POST /api/notifications/mark_read.php
 * Body: { id: 123 } to mark one notification read, or {} to mark all read.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (empty($_SESSION['user_id'])) {
    json_response(['success' => false, 'error' => 'Not logged in.']);
    exit;
}
$userId = (int) $_SESSION['user_id'];

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$notificationId = $input['id'] ?? null;

if ($notificationId !== null) {
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?');
    $stmt->execute([(int) $notificationId, $userId]);
} else {
    $stmt = $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?');
    $stmt->execute([$userId]);
}

json_response(['success' => true]);