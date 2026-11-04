<?php
/**
 * GET /api/profile/get.php?username=someone
 * Another person's public profile page. Login required.
 *
 * Returns: display_name, bio, the location text they typed, joined date,
 * haul and like counts, their PUBLISHED hauls, and the distinct stores they
 * tagged with a count each.
 *
 * Never returns: email, last_lat/last_lng, saved spots, drafts.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
    exit;
}
$viewerId = (int) $_SESSION['user_id'];

$username = (isset($_GET['username']) && is_string($_GET['username'])) ? trim($_GET['username']) : '';
if ($username === '' || mb_strlen($username) > 30) {
    json_error('Invalid username.');
}

$stmt = $pdo->prepare('SELECT id, username, display_name, bio, location, created_at FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();
if (!$user) {
    json_error('Profile not found.', 404);
}
$userId = (int) $user['id'];

// Published hauls only (never drafts), newest first
$stmt = $pdo->prepare("
    SELECT h.id, h.item_name, h.price, h.size, h.color, h.fabric, h.store_id,
           h.image_path, h.created_at, s.name AS store_name,
           (SELECT COUNT(*) FROM haul_likes hl WHERE hl.haul_id = h.id) AS like_count
    FROM hauls h
    LEFT JOIN stores s ON s.id = h.store_id
    WHERE h.user_id = ? AND h.status = 'published'
    ORDER BY h.created_at DESC
    LIMIT 60
");
$stmt->execute([$userId]);
$hauls = $stmt->fetchAll();
foreach ($hauls as &$h) {
    $h['id']         = (int) $h['id'];
    $h['price']      = $h['price'] !== null ? (float) $h['price'] : null;
    $h['store_id']   = $h['store_id'] !== null ? (int) $h['store_id'] : null;
    $h['like_count'] = (int) $h['like_count'];
}
unset($h);

// Likes received on their published hauls
$stmt = $pdo->prepare("
    SELECT COUNT(*) FROM haul_likes hl
    JOIN hauls h ON h.id = hl.haul_id
    WHERE h.user_id = ? AND h.status = 'published'
");
$stmt->execute([$userId]);
$likes = (int) $stmt->fetchColumn();

// Stores they tagged, with how many posts each
$stmt = $pdo->prepare("
    SELECT s.id, s.name, s.address, COUNT(*) AS haul_count
    FROM hauls h
    JOIN stores s ON s.id = h.store_id
    WHERE h.user_id = ? AND h.status = 'published'
    GROUP BY s.id, s.name, s.address
    ORDER BY haul_count DESC, s.name ASC
");
$stmt->execute([$userId]);
$spots = $stmt->fetchAll();
foreach ($spots as &$sp) {
    $sp['id']         = (int) $sp['id'];
    $sp['haul_count'] = (int) $sp['haul_count'];
}
unset($sp);

json_response([
    'user' => [
        'username'     => $user['username'],
        'display_name' => $user['display_name'],
        'bio'          => $user['bio'],
        'location'     => $user['location'],
        'created_at'   => $user['created_at'],
        'is_me'        => $userId === $viewerId,
    ],
    'hauls_count' => count($hauls),
    'likes_count' => $likes,
    'spots_count' => count($spots),
    'hauls'       => $hauls,
    'spots'       => $spots,
]);