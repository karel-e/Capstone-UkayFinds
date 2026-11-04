<?php
/**
 * GET /api/comments/list.php?haul_id=123
 * Comments on one published haul, oldest first (max 100). No login needed to
 * read, like the haul itself. is_mine tells the page which ones to offer a
 * delete button on.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$viewerId = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;

$haulId = (isset($_GET['haul_id']) && ctype_digit((string) $_GET['haul_id'])) ? (int) $_GET['haul_id'] : 0;
if ($haulId <= 0) {
    json_error('Invalid haul id.');
}

$stmt = $pdo->prepare("SELECT id FROM hauls WHERE id = ? AND status = 'published'");
$stmt->execute([$haulId]);
if (!$stmt->fetch()) {
    json_error('Haul not found.', 404);
}

$stmt = $pdo->prepare('
    SELECT c.id, c.body, c.created_at, c.user_id, u.username
    FROM haul_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.haul_id = ?
    ORDER BY c.created_at ASC, c.id ASC
    LIMIT 100
');
$stmt->execute([$haulId]);
$comments = $stmt->fetchAll();

foreach ($comments as &$c) {
    $c['id']      = (int) $c['id'];
    $c['is_mine'] = $viewerId > 0 && (int) $c['user_id'] === $viewerId;
    unset($c['user_id']);   // the page only needs to know "is it mine"
}
unset($c);

json_response(['comments' => $comments]);