<?php
/**
 * GET /api/showcase/list.php
 * Returns the logged-in user's own showcase listings, newest first.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
    exit;
}
$userId = (int) $_SESSION['user_id'];

$stmt = $pdo->prepare("
    SELECT sl.id, sl.item_name, sl.description, sl.image_path, sl.selling_method,
           sl.bid_start_price, sl.bid_increment, sl.lock_price, sl.grab_price, sl.mine_price,
           sl.size, sl.color, sl.fabric, sl.store_id,
           sl.status, sl.created_at,
           s.name AS store_name
    FROM showcase_listings sl
    LEFT JOIN stores s ON s.id = sl.store_id
    WHERE sl.user_id = ? AND sl.status != 'draft'
    ORDER BY sl.created_at DESC
");
$stmt->execute([$userId]);
$listings = $stmt->fetchAll();

foreach ($listings as &$item) {
    $item['id'] = (int) $item['id'];
    $item['store_id'] = $item['store_id'] !== null ? (int) $item['store_id'] : null;
    foreach (['bid_start_price', 'bid_increment', 'lock_price', 'grab_price', 'mine_price'] as $priceField) {
        $item[$priceField] = $item[$priceField] !== null ? (float) $item[$priceField] : null;
    }
}
unset($item);

json_response(['success' => true, 'listings' => $listings]);