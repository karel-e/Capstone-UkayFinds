<?php
/**
 * POST /api/stores/rate.php
 * Body (JSON): { store_id, stars, comment, anonymous }
 *
 * Requires login (the Rate This Spot form only appears inside the
 * dashboard, which is already login-gated) — "anonymous" here means
 * "don't attach my name to this review," not "skip login entirely."
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to rate a spot.', 401);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}

$storeId     = isset($input['store_id']) ? (int) $input['store_id'] : 0;
$stars       = isset($input['stars']) ? (int) $input['stars'] : 0;
$comment     = trim($input['comment'] ?? '');
$isAnonymous = !empty($input['anonymous']);

if ($storeId <= 0) {
    json_error('Missing store_id.');
}
if ($stars < 1 || $stars > 5) {
    json_error('Stars must be between 1 and 5.');
}

// True anonymity: if they chose "Anonymous Thrifter", we don't store
// which account submitted it at all — not even hidden from the UI but
// present in the database. NULL means genuinely not recorded.
$userId = $isAnonymous ? null : $_SESSION['user_id'];

// Wrapped in a transaction with a row lock (FOR UPDATE): if two people
// rate the same store in the same instant, this stops both requests from
// reading the same "before" rating and computing conflicting new
// averages — the second request waits for the first to finish, then
// works from the already-updated number. Skipping this wouldn't break
// obviously in casual testing, only under real concurrent traffic, which
// is exactly the kind of bug that's easy to miss until it's live.
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT rating, rating_count FROM stores WHERE id = ? FOR UPDATE');
    $stmt->execute([$storeId]);
    $store = $stmt->fetch();

    if (!$store) {
        $pdo->rollBack();
        json_error('Store not found.', 404);
    }

    $priorWeight = (int) $store['rating_count'];
    $priorRating = (float) $store['rating'];
    $newWeight   = $priorWeight + 1;
    // Same formula as the frontend's client-side version — a store with
    // a long rating history barely moves from one new vote; a brand-new
    // spot (rating_count 0) just takes the first rating outright.
    $newRating = $priorWeight === 0 ? $stars : (($priorRating * $priorWeight) + $stars) / $newWeight;

    $stmt = $pdo->prepare('UPDATE stores SET rating = ?, rating_count = ? WHERE id = ?');
    $stmt->execute([$newRating, $newWeight, $storeId]);

        $stmt = $pdo->prepare(
        'INSERT INTO spot_ratings (store_id, user_id, stars, comment, is_anonymous) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$storeId, $userId, $stars, $comment !== '' ? $comment : null, $isAnonymous ? 1 : 0]);

    // Notify the store's original submitter that someone rated their spot —
    // skip entirely for seed-data stores (no submitter to notify) and skip
    // if the submitter is rating their own store (no point notifying yourself).
    $stmt = $pdo->prepare('SELECT submitted_by, name FROM stores WHERE id = ?');
    $stmt->execute([$storeId]);
    $storeInfo = $stmt->fetch();

    if ($storeInfo && $storeInfo['submitted_by'] && (int) $storeInfo['submitted_by'] !== (int) $_SESSION['user_id']) {
        $stmt = $pdo->prepare(
            'INSERT INTO notifications (recipient_id, actor_id, type, message, location_label) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $storeInfo['submitted_by'],
            $userId, // NULL if the rater chose anonymous — same rule as spot_ratings itself
            'rating',
            "rated your spot {$stars} star" . ($stars > 1 ? 's' : ''),
            $storeInfo['name'],
        ]);
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    json_error('Could not save rating: ' . $e->getMessage(), 500);
}

json_response([
    'message'      => 'Rating submitted.',
    'store_id'     => $storeId,
    'new_rating'   => round($newRating, 2),
    'rating_count' => $newWeight,
]);