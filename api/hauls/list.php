<?php
/**
 * GET /api/hauls/list.php
 *
 * Query params (optional):
 *   filter=all|near-me|trending|budget
 *       budget   - posts with a price under 200 pesos (computed, no tags needed)
 *       trending - posts from the last 14 days, most liked first
 *       near-me  - posts tagged at a spot within NEAR_ME_KM of lat & lng
 *   lat, lng     - the visitor's coordinates (required for near-me)
 *   mine=1       - "My Hauls" tab on Profile (login required)
 *   q=text       - search usernames, captions, store names, colors and fabrics
 *   username=x   - only this person's published hauls (exact match)
 *
 * No login required for the public feed.
 */
require_once __DIR__ . '/../config.php';

const NEAR_ME_KM     = 10;   // same "30-minute ride" radius the store finder uses
const BUDGET_UNDER   = 200;  // pesos
const TRENDING_DAYS  = 14;

if (!function_exists('haversineKm')) {
    function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}

$filter = $_GET['filter'] ?? 'all';
if (!is_string($filter) || !in_array($filter, ['all', 'near-me', 'trending', 'budget'], true)) {
    $filter = 'all';
}
$mine = !empty($_GET['mine']); // "My Hauls" tab on Profile - only this user's own hauls

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$viewerId = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;

// Search text (max 60 chars). Non-string input (q[]=x) is ignored, not a crash.
$q = (isset($_GET['q']) && is_string($_GET['q'])) ? trim(mb_substr($_GET['q'], 0, 60)) : '';
$usernameFilter = (isset($_GET['username']) && is_string($_GET['username'])) ? trim($_GET['username']) : '';

if ($mine) {
    if (empty($_SESSION['user_id'])) {
        json_error('Not logged in.', 401);
        exit;
    }
}

// near-me needs the visitor's position; without it there is nothing to measure from
$lat = (isset($_GET['lat']) && is_numeric($_GET['lat'])) ? (float) $_GET['lat'] : null;
$lng = (isset($_GET['lng']) && is_numeric($_GET['lng'])) ? (float) $_GET['lng'] : null;
$hasPosition = $lat !== null && $lng !== null && abs($lat) <= 90 && abs($lng) <= 180;

if (!$mine && $filter === 'near-me' && !$hasPosition) {
    json_response(['hauls' => [], 'needs_location' => true]);
    exit;
}

$sql = '
    SELECT
        h.id,
        h.item_name,
        h.price,
        h.image_path,
        h.created_at,
        h.size,
        h.color,
        h.fabric,
        h.store_id,
        u.username,
        s.name AS store_name,
        s.latitude  AS store_lat,
        s.longitude AS store_lng,
        (SELECT COUNT(*) FROM haul_likes hl WHERE hl.haul_id = h.id) AS like_count,
        (SELECT COUNT(*) FROM haul_likes hl2 WHERE hl2.haul_id = h.id AND hl2.user_id = ?) AS liked_by_me
    FROM hauls h
    JOIN users u ON u.id = h.user_id
    LEFT JOIN stores s ON s.id = h.store_id
';

$conditions = ["h.status = 'published'"];
$params = [$viewerId];   // first placeholder is the liked_by_me subquery above
$orderBy = 'h.created_at DESC';

if ($mine) {
    $conditions[] = 'h.user_id = ?';
    $params[] = $_SESSION['user_id'];
} elseif ($filter === 'budget') {
    $conditions[] = 'h.price IS NOT NULL AND h.price < ' . (int) BUDGET_UNDER;
} elseif ($filter === 'trending') {
    $conditions[] = 'h.created_at >= (NOW() - INTERVAL ' . (int) TRENDING_DAYS . ' DAY)';
    $orderBy = 'like_count DESC, h.created_at DESC';
} elseif ($filter === 'near-me') {
    $conditions[] = 'h.store_id IS NOT NULL';
}

if (!$mine && $usernameFilter !== '') {
    $conditions[] = 'u.username = ?';
    $params[] = $usernameFilter;
}

if (!$mine && $q !== '') {
    // Escape \ % and _ so what the person types is searched literally
    $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';
    $conditions[] = '(u.username LIKE ? OR h.item_name LIKE ? OR s.name LIKE ? OR h.color LIKE ? OR h.fabric LIKE ?)';
    array_push($params, $like, $like, $like, $like, $like);
}

$sql .= ' WHERE ' . implode(' AND ', $conditions) . ' ORDER BY ' . $orderBy;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$hauls = $stmt->fetchAll();

if (!$mine && $filter === 'near-me') {
    $hauls = array_values(array_filter($hauls, function ($h) use ($lat, $lng) {
        return $h['store_lat'] !== null
            && haversineKm($lat, $lng, (float) $h['store_lat'], (float) $h['store_lng']) <= NEAR_ME_KM;
    }));
}

foreach ($hauls as &$haul) {
    $haul['id']         = (int) $haul['id'];
    $haul['price']      = $haul['price'] !== null ? (float) $haul['price'] : null;
    $haul['store_id']   = $haul['store_id'] !== null ? (int) $haul['store_id'] : null;
    $haul['like_count'] = (int) $haul['like_count'];
    $haul['liked_by_me'] = ((int) $haul['liked_by_me']) > 0;
    unset($haul['store_lat'], $haul['store_lng']); // only needed for the distance check
}
unset($haul);

json_response(['hauls' => $hauls]);