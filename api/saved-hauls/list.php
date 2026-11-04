<?php
/**
 * GET /api/saved-hauls/list.php
 * The logged-in user's saved hauls, newest save first. Only published hauls
 * are returned (a haul that was deleted or unpublished drops out). Returns
 * the same card fields the feed uses: { hauls: [...] }
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare(
        "SELECT h.id, h.item_name, h.price, h.image_path, h.size, h.color, h.fabric,
                h.store_id, s.name AS store_name, u.username
           FROM saved_hauls sh
           JOIN hauls h ON h.id = sh.haul_id AND h.status = 'published'
           JOIN users u ON u.id = h.user_id
           LEFT JOIN stores s ON s.id = h.store_id
          WHERE sh.user_id = ?
          ORDER BY sh.created_at DESC, sh.id DESC"
    );
    $stmt->execute([$userId]);
    $hauls = $stmt->fetchAll();
} catch (PDOException $e) {
    error_log('saved-hauls/list.php: ' . $e->getMessage());
    json_error('Could not load your saved items.', 500);
}

foreach ($hauls as &$h) {
    $h['id']       = (int) $h['id'];
    $h['price']    = $h['price'] !== null ? (float) $h['price'] : null;
    $h['store_id'] = $h['store_id'] !== null ? (int) $h['store_id'] : null;
}
unset($h);

json_response(['hauls' => $hauls]);