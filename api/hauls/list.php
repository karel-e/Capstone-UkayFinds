<?php
/**
 * GET /api/hauls/list.php
 *
 * Query params (optional):
 *   filter=near-me|trending|budget   — matches a haul_tags row
 *
 * No login required — anyone should be able to browse the community feed.
 */
require_once __DIR__ . '/../config.php';

$filter = $_GET['filter'] ?? 'all';
$mine   = !empty($_GET['mine']); // "My Hauls" tab on Profile — only this user's own hauls

if ($mine) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (empty($_SESSION['user_id'])) {
        json_response(['success' => false, 'error' => 'Not logged in.']);
        exit;
    }
}

$sql = '
    SELECT
        h.id,
        h.item_name,
        h.price,
        h.image_path,
        h.created_at,
        u.username,
        s.name AS store_name,
        (SELECT COUNT(*) FROM haul_likes hl WHERE hl.haul_id = h.id) AS like_count,
        (SELECT GROUP_CONCAT(tag) FROM haul_tags ht WHERE ht.haul_id = h.id) AS tags
    FROM hauls h
    JOIN users u ON u.id = h.user_id
    LEFT JOIN stores s ON s.id = h.store_id
';

$conditions = ["h.status = 'published'"];
$params = [];

if ($mine) {
    $conditions[] = 'h.user_id = ?';
    $params[] = $_SESSION['user_id'];
} elseif ($filter !== 'all') {
    $conditions[] = 'h.id IN (SELECT haul_id FROM haul_tags WHERE tag = ?)';
    $params[] = $filter;
}

if ($conditions) {
    $sql .= ' WHERE ' . implode(' AND ', $conditions);
}

$sql .= ' ORDER BY h.created_at DESC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$hauls = $stmt->fetchAll();

foreach ($hauls as &$haul) {
    $haul['id']         = (int) $haul['id'];
    $haul['price']      = $haul['price'] !== null ? (float) $haul['price'] : null;
    $haul['like_count'] = (int) $haul['like_count'];
    $haul['tags']       = $haul['tags'] ? explode(',', $haul['tags']) : [];
}
unset($haul);

json_response(['hauls' => $hauls]);