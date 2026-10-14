<?php
/**
 * GET /api/saved-spots/list.php
 * Returns the logged-in user's saved spots, with live store data joined in
 * (name, rating, address) rather than snapshotting it at save-time.
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
    SELECT s.id, s.name, s.rating, s.rating_count, s.address, s.latitude, s.longitude
    FROM saved_spots ss
    JOIN stores s ON s.id = ss.store_id
    WHERE ss.user_id = ?
    ORDER BY ss.created_at DESC
');
$stmt->execute([$userId]);
$spots = $stmt->fetchAll();

foreach ($spots as &$spot) {
    $spot['id'] = (int) $spot['id'];
    $spot['rating'] = (float) $spot['rating'];
    $spot['rating_count'] = (int) $spot['rating_count'];
    $spot['latitude'] = (float) $spot['latitude'];
    $spot['longitude'] = (float) $spot['longitude'];
}
unset($spot);

json_response(['success' => true, 'spots' => $spots]);