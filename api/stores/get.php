<?php
/**
 * GET /api/stores/get.php?id=12
 * Everything the "stall details" panel needs, in one call:
 *   the stall, its written reviews (newest first) and the hauls tagged to it.
 * No login needed. Reviewers' user ids and emails are never sent; a review
 * posted as anonymous shows as "Anonymous thrifter".
 */
require_once __DIR__ . '/../config.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    json_error('Missing stall id.');
}

$stmt = $pdo->prepare(
    'SELECT id, name, latitude, longitude, status_text, price_range, address, image_path, rating, rating_count
       FROM stores WHERE id = ?'
);
$stmt->execute([$id]);
$store = $stmt->fetch();
if (!$store) {
    json_error('Stall not found.', 404);
}
$store['id']           = (int) $store['id'];
$store['latitude']     = (float) $store['latitude'];
$store['longitude']    = (float) $store['longitude'];
$store['rating']       = (float) $store['rating'];
$store['rating_count'] = (int) $store['rating_count'];

// ---- Reviews (only ratings that have written text) ----
$stmt = $pdo->prepare(
    "SELECT r.stars, r.comment, r.is_anonymous, r.created_at, u.username
       FROM spot_ratings r
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.store_id = ? AND r.comment IS NOT NULL AND r.comment <> ''
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 20"
);
$stmt->execute([$id]);
$reviews = [];
foreach ($stmt->fetchAll() as $r) {
    $anon = (int) $r['is_anonymous'] === 1 || $r['username'] === null;
    $reviews[] = [
        'stars'      => (int) $r['stars'],
        'comment'    => $r['comment'],
        'author'     => $anon ? 'Anonymous thrifter' : $r['username'],
        'anonymous'  => $anon,
        'created_at' => $r['created_at'],
    ];
}

// ---- Hauls tagged to this stall ----
$stmt = $pdo->prepare("SELECT COUNT(*) FROM hauls WHERE store_id = ? AND status = 'published'");
$stmt->execute([$id]);
$haulCount = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare(
    "SELECT h.id, h.item_name, h.price, h.image_path, u.username
       FROM hauls h
       JOIN users u ON u.id = h.user_id
      WHERE h.store_id = ? AND h.status = 'published'
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT 12"
);
$stmt->execute([$id]);
$hauls = $stmt->fetchAll();
foreach ($hauls as &$h) {
    $h['id']    = (int) $h['id'];
    $h['price'] = $h['price'] !== null ? (float) $h['price'] : null;
}
unset($h);

json_response([
    'store'      => $store,
    'reviews'    => $reviews,
    'hauls'      => $hauls,
    'haul_count' => $haulCount,
]);