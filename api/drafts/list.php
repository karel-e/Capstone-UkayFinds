<?php
/**
 * GET /api/drafts/list.php
 * The logged-in user's unpublished hauls (drafts), newest first.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

$stmt = $pdo->prepare("
    SELECT h.id, h.item_name, h.price, h.image_path, h.created_at,
           h.size, h.color, h.fabric, h.store_id,
           s.name AS store_name
    FROM hauls h
    LEFT JOIN stores s ON s.id = h.store_id
    WHERE h.user_id = ? AND h.status = 'draft'
    ORDER BY h.created_at DESC
");
$stmt->execute([$userId]);
$hauls = $stmt->fetchAll();
foreach ($hauls as &$h) {
    $h['id'] = (int) $h['id'];
    $h['price'] = $h['price'] !== null ? (float) $h['price'] : null;
    $h['store_id'] = $h['store_id'] !== null ? (int) $h['store_id'] : null;
}
unset($h);

json_response(['hauls' => $hauls]);