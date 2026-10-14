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
    json_response(['success' => false, 'error' => 'Not logged in.']);
    exit;
}
$userId = (int) $_SESSION['user_id'];

$stmt = $pdo->prepare("
    SELECT id, item_name, description, image_path, selling_method,
           bid_start_price, bid_increment, lock_price, grab_price, mine_price,
           status, created_at
    FROM showcase_listings
    WHERE user_id = ? AND status != 'draft'
    ORDER BY created_at DESC
");
$stmt->execute([$userId]);
$listings = $stmt->fetchAll();

foreach ($listings as &$item) {
    $item['id'] = (int) $item['id'];
    foreach (['bid_start_price', 'bid_increment', 'lock_price', 'grab_price', 'mine_price'] as $priceField) {
        $item[$priceField] = $item[$priceField] !== null ? (float) $item[$priceField] : null;
    }
}
unset($item);

json_response(['success' => true, 'listings' => $listings]);