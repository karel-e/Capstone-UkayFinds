<?php
/**
 * GET /api/notifications/list.php
 * Returns the logged-in user's own notifications, newest first.
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

$stmt = $pdo->prepare('
    SELECT n.id, n.type, n.message, n.location_label, n.is_read, n.created_at,
           u.username AS actor_username
    FROM notifications n
    LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.recipient_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
');
$stmt->execute([$userId]);
$notifications = $stmt->fetchAll();

foreach ($notifications as &$n) {
    $n['id'] = (int) $n['id'];
    $n['is_read'] = (bool) $n['is_read'];
}
unset($n);

json_response(['success' => true, 'notifications' => $notifications]);