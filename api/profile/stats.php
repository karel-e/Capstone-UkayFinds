<?php
/**
 * GET /api/profile/stats.php
 * Returns the logged-in user's real counts for the Profile page:
 * - hauls they've posted
 * - likes received across all their hauls
 * - spots they've saved
 */
require_once __DIR__ . '/../config.php'; // config.php already starts the session

if (empty($_SESSION['user_id'])) {
    json_response(['success' => false, 'error' => 'Not logged in.']);
}
$userId = (int) $_SESSION['user_id'];

$stmt = $pdo->prepare("SELECT COUNT(*) FROM hauls WHERE user_id = ? AND status = 'published'");
$stmt->execute([$userId]);
$haulsCount = (int) $stmt->fetchColumn();

// Likes received: count rows in haul_likes for any haul this user posted —
// not likes this user has given to others.
$stmt = $pdo->prepare("
    SELECT COUNT(*) FROM haul_likes hl
    JOIN hauls h ON h.id = hl.haul_id
    WHERE h.user_id = ? AND h.status = 'published'
");
$stmt->execute([$userId]);
$likesCount = (int) $stmt->fetchColumn();

// Saved spots: this used to count hauls a second time by mistake.
$stmt = $pdo->prepare('SELECT COUNT(*) FROM saved_spots WHERE user_id = ?');
$stmt->execute([$userId]);
$savedCount = (int) $stmt->fetchColumn();

json_response([
    'success'      => true,
    'hauls_count'  => $haulsCount,
    'likes_count'  => $likesCount,
    'saved_count'  => $savedCount,
]);