<?php
/**
 * GET /api/hauls/get.php?id=123
 * One published haul with everything the detail window needs: photo, caption,
 * size/color/fabric, price, the tagged spot (id + name), who posted it and
 * when, the like count and whether the logged-in visitor liked it.
 * Drafts are never returned. No login needed, like the public feed.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$id = (isset($_GET['id']) && ctype_digit((string) $_GET['id'])) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    json_error('Invalid haul id.');
}
$viewerId = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;

$stmt = $pdo->prepare('
    SELECT
        h.id, h.item_name, h.price, h.image_path, h.size, h.color, h.fabric,
        h.store_id, h.created_at,
        u.username,
        s.name AS store_name,
        (SELECT COUNT(*) FROM haul_likes hl WHERE hl.haul_id = h.id) AS like_count,
        (SELECT COUNT(*) FROM haul_likes hl WHERE hl.haul_id = h.id AND hl.user_id = ?) AS liked_by_me
    FROM hauls h
    JOIN users u ON u.id = h.user_id
    LEFT JOIN stores s ON s.id = h.store_id
    WHERE h.id = ? AND h.status = \'published\'
');
$stmt->execute([$viewerId, $id]);
$haul = $stmt->fetch();
if (!$haul) {
    json_error('Haul not found.', 404);
}

$haul['id']          = (int) $haul['id'];
$haul['price']       = $haul['price'] !== null ? (float) $haul['price'] : null;
$haul['store_id']    = $haul['store_id'] !== null ? (int) $haul['store_id'] : null;
$haul['like_count']  = (int) $haul['like_count'];
$haul['liked_by_me'] = ((int) $haul['liked_by_me']) > 0;

json_response(['haul' => $haul]);