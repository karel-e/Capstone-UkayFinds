<?php
/**
 * POST /api/stores/rate.php
 * Body (JSON): { store_id, stars, comment, anonymous }
 *
 * One rating per user per store. spot_ratings.user_id is ALWAYS stored
 * (private, never sent to the browser); is_anonymous only controls how
 * other users see the rating. Rating again updates the existing row.
 */
require_once __DIR__ . '/../config.php';

const MAX_NEW_RATINGS_PER_DAY = 20;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to rate a spot.', 401);
}
$userId = (int) $_SESSION['user_id'];

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
if (mb_strlen($comment) > 500) {
    json_error('Review must be 500 characters or fewer.');
}

$pdo->beginTransaction();
try {
    // Lock this store's row so two simultaneous ratings can't overwrite each other
    $stmt = $pdo->prepare('SELECT rating, rating_count, submitted_by, name FROM stores WHERE id = ? FOR UPDATE');
    $stmt->execute([$storeId]);
    $store = $stmt->fetch();

    if (!$store) {
        $pdo->rollBack();
        json_error('Store not found.', 404);
    }
    if ($store['submitted_by'] !== null && (int) $store['submitted_by'] === $userId) {
        $pdo->rollBack();
        json_error("You can't rate a spot you submitted yourself.", 403);
    }

    $stmt = $pdo->prepare('SELECT id, stars FROM spot_ratings WHERE store_id = ? AND user_id = ? FOR UPDATE');
    $stmt->execute([$storeId, $userId]);
    $existing = $stmt->fetch();

    $count = (int) $store['rating_count'];
    $avg   = (float) $store['rating'];
    $commentValue = $comment !== '' ? $comment : null;

    if ($existing) {
        // Changing a previous rating: swap the old stars for the new ones
        $newCount  = $count;
        $newRating = $count > 0 ? (($avg * $count) - (int) $existing['stars'] + $stars) / $count : $stars;

        $stmt = $pdo->prepare('UPDATE spot_ratings SET stars = ?, comment = ?, is_anonymous = ? WHERE id = ?');
        $stmt->execute([$stars, $commentValue, $isAnonymous ? 1 : 0, $existing['id']]);
        $wasUpdate = true;
    } else {
        // Daily limit on brand-new ratings (stops one account spamming many stores)
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM spot_ratings WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 DAY');
        $stmt->execute([$userId]);
        if ((int) $stmt->fetchColumn() >= MAX_NEW_RATINGS_PER_DAY) {
            $pdo->rollBack();
            json_error('You\'ve reached today\'s rating limit. Try again tomorrow.', 429);
        }

        $newCount  = $count + 1;
        $newRating = $count === 0 ? $stars : (($avg * $count) + $stars) / $newCount;

        $stmt = $pdo->prepare(
            'INSERT INTO spot_ratings (store_id, user_id, stars, comment, is_anonymous) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$storeId, $userId, $stars, $commentValue, $isAnonymous ? 1 : 0]);
        $wasUpdate = false;

        // Tell the store's submitter (only for new ratings, not edits)
        if ($store['submitted_by']) {
            $stmt = $pdo->prepare(
                'INSERT INTO notifications (recipient_id, actor_id, type, message, location_label, target_type, target_id) VALUES (?, ?, ?, ?, ?, \'store\', ?)'
            );
            $stmt->execute([
                $store['submitted_by'],
                $isAnonymous ? null : $userId,
                'rating',
                "rated your spot {$stars} star" . ($stars > 1 ? 's' : ''),
                $store['name'],
                $storeId,
            ]);
        }
    }

    $newRating = round(max(0, min(5, $newRating)), 2);
    $stmt = $pdo->prepare('UPDATE stores SET rating = ?, rating_count = ? WHERE id = ?');
    $stmt->execute([$newRating, $newCount, $storeId]);

    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('rate.php: ' . $e->getMessage());
    if ($e->getCode() === '23000') {
        json_error('You already rated this spot. Please try again.', 409);
    }
    json_error('Could not save rating.', 500);
}

json_response([
    'message'      => $wasUpdate ? 'Rating updated.' : 'Rating submitted.',
    'updated'      => $wasUpdate,
    'store_id'     => $storeId,
    'new_rating'   => $newRating,
    'rating_count' => $newCount,
]);