<?php
/**
 * GET /api/drafts/list.php
 * The logged-in user's unpublished hauls and showcase listings, newest first.
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
    SELECT h.id, h.item_name, h.price, h.image_path, h.created_at, s.name AS store_name
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
}
unset($h);

$stmt = $pdo->prepare("
    SELECT id, item_name, description, image_path, selling_method,
           bid_start_price, bid_increment, lock_price, grab_price, mine_price, created_at
    FROM showcase_listings
    WHERE user_id = ? AND status = 'draft'
    ORDER BY created_at DESC
");
$stmt->execute([$userId]);
$showcase = $stmt->fetchAll();
foreach ($showcase as &$d) {
    $d['id'] = (int) $d['id'];
    foreach (['bid_start_price', 'bid_increment', 'lock_price', 'grab_price', 'mine_price'] as $f) {
        $d[$f] = $d[$f] !== null ? (float) $d[$f] : null;
    }
}
unset($d);

json_response(['hauls' => $hauls, 'showcase' => $showcase]);