<?php
/**
 * GET /api/saved-spots/list.php
 * Returns the logged-in user's saved spots, with live store data joined in
 * (name, rating, address) rather than snapshotting it at save-time.
 *
 * Optional query params:
 *   lat, lng - the visitor's coordinates. When present each spot gets a real
 *              distance_km / distance_label and the list is ordered nearest
 *              first. Without them it stays "most recently saved first".
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

$lat = (isset($_GET['lat']) && is_numeric($_GET['lat'])) ? (float) $_GET['lat'] : null;
$lng = (isset($_GET['lng']) && is_numeric($_GET['lng'])) ? (float) $_GET['lng'] : null;
$hasPosition = $lat !== null && $lng !== null && abs($lat) <= 90 && abs($lng) <= 180;

if (!function_exists('haversineKm')) {
    function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}

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

    if ($hasPosition) {
        $km = haversineKm($lat, $lng, $spot['latitude'], $spot['longitude']);
        $spot['distance_km']    = round($km, 2);
        $spot['distance_label'] = $km < 1
            ? round($km * 1000) . 'm from your location'
            : round($km, 1) . 'km from your location';
    } else {
        $spot['distance_km']    = null;
        $spot['distance_label'] = $spot['address'];
    }
}
unset($spot);

if ($hasPosition) {
    usort($spots, fn($a, $b) => $a['distance_km'] <=> $b['distance_km']);
}

json_response(['success' => true, 'spots' => $spots]);