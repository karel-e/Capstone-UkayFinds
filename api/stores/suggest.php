<?php
/**
 * POST /api/stores/suggest.php
 * Body (multipart/form-data): name, address, hours, price_range, latitude,
 *                             longitude, image? (PNG/JPG file, max 5 MB)
 *
 * Requires login. Abuse guards:
 *  - max MAX_SPOTS_PER_DAY new spots per user per rolling 24h  (429)
 *  - same name (case-insensitive) within DUPLICATE_RADIUS_M    (409)
 *  - field length / coordinate / photo sanity checks           (400)
 */
require_once __DIR__ . '/../config.php';

const MAX_SPOTS_PER_DAY   = 5;
const DUPLICATE_RADIUS_M  = 100;
const MAX_PHOTO_BYTES     = 5 * 1024 * 1024;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to suggest a spot.', 401);
}

// A file bigger than PHP's post_max_size arrives with $_POST and $_FILES both empty
if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json_error('That upload is too large.', 413);
}

function post_text(string $key): string
{
    return (isset($_POST[$key]) && is_string($_POST[$key])) ? trim($_POST[$key]) : '';
}

$name       = post_text('name');
$address    = post_text('address');
$hours      = post_text('hours');
$priceRange = post_text('price_range');
$lat        = is_numeric($_POST['latitude']  ?? null) ? (float) $_POST['latitude']  : null;
$lng        = is_numeric($_POST['longitude'] ?? null) ? (float) $_POST['longitude'] : null;

if ($name === '') {
    json_error('Give the spot a name.');
}
if (mb_strlen($name) > 100 || mb_strlen($address) > 180 || mb_strlen($hours) > 60 || mb_strlen($priceRange) > 60) {
    json_error('One of the fields is too long.');
}
if ($lat === null || $lng === null || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    json_error('Missing or invalid location coordinates.');
}

// ---- Photo checks (optional field) ----
$uploadError = $_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE;
if ($uploadError !== UPLOAD_ERR_OK && $uploadError !== UPLOAD_ERR_NO_FILE) {
    $msg = in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
        ? 'Photo must be under 5MB.'
        : 'The photo could not be uploaded. Please try again.';
    json_error($msg);
}
$hasUpload = ($uploadError === UPLOAD_ERR_OK);
$photoExt = null;
if ($hasUpload) {
    $allowedTypes = ['image/png' => 'png', 'image/jpeg' => 'jpg'];
    $mimeType = mime_content_type($_FILES['image']['tmp_name']);
    if (!isset($allowedTypes[$mimeType])) {
        json_error('Only PNG and JPG photos are allowed.');
    }
    if ($_FILES['image']['size'] > MAX_PHOTO_BYTES) {
        json_error('Photo must be under 5MB.');
    }
    $photoExt = $allowedTypes[$mimeType];
}

$userId = $_SESSION['user_id'];

// ---- 1. Daily limit ----
$stmt = $pdo->prepare(
    'SELECT COUNT(*) FROM stores WHERE submitted_by = ? AND created_at > (NOW() - INTERVAL 1 DAY)'
);
$stmt->execute([$userId]);
if ((int)$stmt->fetchColumn() >= MAX_SPOTS_PER_DAY) {
    json_error('You can suggest up to ' . MAX_SPOTS_PER_DAY . ' spots per day. Try again tomorrow.', 429);
}

// ---- 2. Same name within ~100 m ----
// Bounding box first (cheap, can use an index), then exact haversine distance.
$latDelta = DUPLICATE_RADIUS_M / 111320;
$lngDelta = $latDelta / max(cos(deg2rad($lat)), 0.01);

$stmt = $pdo->prepare(
    'SELECT id FROM stores
      WHERE LOWER(TRIM(name)) = LOWER(?)
        AND latitude  BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND 6371000 * 2 * ASIN(SQRT(
              POW(SIN(RADIANS(latitude - ?) / 2), 2) +
              COS(RADIANS(?)) * COS(RADIANS(latitude)) *
              POW(SIN(RADIANS(longitude - ?) / 2), 2)
            )) < ?
      LIMIT 1'
);
$stmt->execute([
    $name,
    $lat - $latDelta, $lat + $latDelta,
    $lng - $lngDelta, $lng + $lngDelta,
    $lat, $lat, $lng,
    DUPLICATE_RADIUS_M,
]);
if ($stmt->fetchColumn()) {
    json_error('A spot with this name already exists right here. Try rating it instead.', 409);
}

// ---- 3. Save the photo (only after every other check passed) ----
$imagePath = null;
$savedFile = null;
if ($hasUpload) {
    $uploadDir = __DIR__ . '/../../uploads/stores/';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
        error_log('suggest.php: cannot create ' . $uploadDir);
        json_error('Could not save the photo.', 500);
    }
    $filename = 'store_' . (int) $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $photoExt;
    if (!move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $filename)) {
        error_log('suggest.php: move_uploaded_file failed for ' . $uploadDir . $filename);
        json_error('Could not save the photo.', 500);
    }
    $savedFile = $uploadDir . $filename;
    $imagePath = 'uploads/stores/' . $filename;
}

// ---- 4. Insert (new spots start unrated: 0 / 0, frontend shows "New") ----
try {
    $stmt = $pdo->prepare(
        'INSERT INTO stores (name, latitude, longitude, status_text, rating, rating_count, price_range, address, image_path, submitted_by, reviewed)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 0)'
    );
    $stmt->execute([
        $name,
        $lat,
        $lng,
        $hours !== '' ? $hours : 'Hours not specified',
        $priceRange !== '' ? $priceRange : 'Price range not specified',
        $address !== '' ? $address : 'Community-submitted spot',
        $imagePath,
        $userId,
    ]);
} catch (PDOException $e) {
    if ($savedFile !== null) {
        @unlink($savedFile);   // don't leave an orphan photo behind
    }
    throw $e;
}

json_response([
    'message' => 'Spot submitted.',
    'store' => [
        'id'         => (int)$pdo->lastInsertId(),
        'name'       => $name,
        'latitude'   => $lat,
        'longitude'  => $lng,
        'image_path' => $imagePath,
    ],
], 201);