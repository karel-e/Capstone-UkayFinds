<?php
/**
 * POST /api/stores/suggest.php
 * Body (JSON): { name, address, hours, price_range, latitude, longitude }
 *
 * Requires login — matches "Suggest a New Spot" being reachable only from
 * inside the dashboard, which is already gated behind session auth.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to suggest a spot.', 401);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}

$name       = trim($input['name'] ?? '');
$address    = trim($input['address'] ?? '');
$hours      = trim($input['hours'] ?? '');
$priceRange = trim($input['price_range'] ?? '');
$lat        = isset($input['latitude']) ? (float) $input['latitude'] : null;
$lng        = isset($input['longitude']) ? (float) $input['longitude'] : null;

if ($name === '') {
    json_error('Give the spot a name.');
}
if ($lat === null || $lng === null) {
    json_error('Missing location coordinates.');
}

// New spots start with no rating at all (0 / 0) rather than a fake
// starting score — the frontend already knows to show "New" instead of
// a star number when rating_count is 0.
$stmt = $pdo->prepare(
    'INSERT INTO stores (name, latitude, longitude, status_text, rating, rating_count, price_range, address, submitted_by)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)'
);
$stmt->execute([
    $name,
    $lat,
    $lng,
    $hours !== '' ? $hours : 'Hours not specified',
    $priceRange !== '' ? $priceRange : 'Price range not specified',
    $address !== '' ? $address : 'Community-submitted spot',
    $_SESSION['user_id'],
]);

$storeId = (int) $pdo->lastInsertId();

json_response([
    'message' => 'Spot submitted.',
    'store' => [
        'id'        => $storeId,
        'name'      => $name,
        'latitude'  => $lat,
        'longitude' => $lng,
    ],
], 201);