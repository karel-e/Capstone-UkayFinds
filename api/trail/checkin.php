<?php
/**
 * POST /api/trail/checkin.php
 * Body (JSON): { store_id, lat, lng, accuracy? }
 *
 * "I'm here": gives the logged-in user a stamp for this stall when
 *   - they are within CHECKIN_RADIUS_M of it (the server measures, not the browser)
 *   - they have no stamp for it yet today (one per stall per day; asking twice is not an error)
 *   - the stall was not suggested by themselves
 * Finishing a trail (enough different stalls in its city) creates a reward
 * code once and a notification. Nothing here involves payment.
 */
require_once __DIR__ . '/_trail.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('Log in to collect stamps.', 401);
}
$userId = (int) $_SESSION['user_id'];

$in = json_decode(file_get_contents('php://input'), true);
$storeId = (is_array($in) && isset($in['store_id'])) ? (int) $in['store_id'] : 0;
$lat = (is_array($in) && isset($in['lat']) && is_numeric($in['lat'])) ? (float) $in['lat'] : null;
$lng = (is_array($in) && isset($in['lng']) && is_numeric($in['lng'])) ? (float) $in['lng'] : null;
$acc = (is_array($in) && isset($in['accuracy']) && is_numeric($in['accuracy'])) ? (float) $in['accuracy'] : 0.0;
if ($storeId <= 0 || $lat === null || $lng === null || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    json_error('We need your location to stamp this stall.');
}

$stmt = $pdo->prepare('SELECT id, name, address, latitude, longitude, submitted_by FROM stores WHERE id = ?');
$stmt->execute([$storeId]);
$store = $stmt->fetch();
if (!$store) {
    json_error('Stall not found.', 404);
}
if ($store['submitted_by'] !== null && (int) $store['submitted_by'] === $userId) {
    json_error("You can't stamp a stall you suggested yourself.", 403);
}

$dist = trail_distance_m($lat, $lng, (float) $store['latitude'], (float) $store['longitude']);
$allowed = CHECKIN_RADIUS_M + min(max($acc, 0), MAX_GPS_SLACK_M);
if ($dist > $allowed) {
    json_error('You need to be at the stall to stamp it. You are about ' . (int) round($dist) . ' m away.', 403);
}

$today = trail_today();
$already = false;
try {
    $pdo->prepare('INSERT INTO trail_stamps (user_id, store_id, stamp_date) VALUES (?, ?, ?)')
        ->execute([$userId, $storeId, $today]);
} catch (PDOException $e) {
    if ($e->getCode() !== '23000') {
        error_log('trail/checkin.php: ' . $e->getMessage());
        json_error('Could not save your stamp.', 500);
    }
    $already = true;   // same stall, same day: not an error
}

// ---- Did this finish a trail? ----
$completed = [];
$progress  = [];
foreach (trail_active($pdo) as $t) {
    if ($t['city'] !== '' && stripos((string) $store['address'], $t['city']) === false) {
        continue;   // this stall is not on that trail
    }
    $count = count(trail_visited($pdo, $userId, $t));
    $progress[] = ['trail_id' => $t['id'], 'name' => $t['name'], 'count' => min($count, $t['stamps_needed']), 'needed' => $t['stamps_needed']];
    if ($count < $t['stamps_needed']) {
        continue;
    }
    $stmt = $pdo->prepare('SELECT code FROM trail_rewards WHERE user_id = ? AND trail_id = ?');
    $stmt->execute([$userId, $t['id']]);
    if ($stmt->fetchColumn() !== false) {
        continue;   // reward already given
    }
    $code = strtoupper(bin2hex(random_bytes(3)));   // 6 characters
    try {
        $pdo->prepare('INSERT INTO trail_rewards (user_id, trail_id, code) VALUES (?, ?, ?)')->execute([$userId, $t['id'], $code]);
        $pdo->prepare(
            "INSERT INTO notifications (recipient_id, actor_id, type, message, location_label, target_type, target_id)
             VALUES (?, NULL, 'system', ?, ?, 'trail', ?)"
        )->execute([$userId, 'You finished the ' . $t['name'] . '! Your reward code is ' . $code . '.', $t['name'], $t['id']]);
        $completed[] = ['trail_id' => $t['id'], 'name' => $t['name'], 'code' => $code, 'reward' => $t['reward_text']];
    } catch (PDOException $e) {
        if ($e->getCode() !== '23000') { error_log('trail/checkin.php reward: ' . $e->getMessage()); }
    }
}

json_response([
    'message'   => $already ? 'You already stamped ' . $store['name'] . ' today.' : 'Stamped ' . $store['name'] . '!',
    'already'   => $already,
    'store_id'  => $storeId,
    'progress'  => $progress,
    'completed' => $completed,
]);