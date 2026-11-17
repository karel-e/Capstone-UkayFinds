<?php
/**
 * POST /api/profile/location.php
 * Body (JSON): { lat, lng }
 *
 * The app calls this only after the browser's own location prompt was
 * allowed. It is used for one thing: telling the person when a new stall is
 * approved within about 10 km. The position is rounded to ~100 m before it is
 * stored, and is never shown to other users.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}

$input = json_decode(file_get_contents('php://input'), true);
$lat = (is_array($input) && isset($input['lat']) && is_numeric($input['lat'])) ? (float) $input['lat'] : null;
$lng = (is_array($input) && isset($input['lng']) && is_numeric($input['lng'])) ? (float) $input['lng'] : null;
if ($lat === null || $lng === null || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    json_error('Invalid location.');
}

try {
    $pdo->prepare('UPDATE users SET last_lat = ?, last_lng = ? WHERE id = ?')
        ->execute([round($lat, 3), round($lng, 3), (int) $_SESSION['user_id']]);
} catch (PDOException $e) {
    error_log('profile/location.php: ' . $e->getMessage());
    json_error('Could not save your location.', 500);
}
json_response(['message' => 'Saved.']);