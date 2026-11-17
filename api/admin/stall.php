<?php
/**
 * POST /api/admin/stall.php   (admins only)
 * Body (JSON): { id, action: "approve" | "remove" | "merge", into? }
 *   approve : the stall stays and leaves the review list
 *   remove  : the stall is deleted (its saved-spot and rating rows go with it)
 *   merge   : everything on this stall (hauls, ratings, saves) moves to the
 *             stall "into", then this duplicate is deleted
 */
require_once __DIR__ . '/_guard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
require_admin($pdo);

$input  = json_decode(file_get_contents('php://input'), true);
$id     = (is_array($input) && isset($input['id'])) ? (int) $input['id'] : 0;
$action = (is_array($input) && isset($input['action'])) ? (string) $input['action'] : '';
$into   = (is_array($input) && isset($input['into'])) ? (int) $input['into'] : 0;
if ($id <= 0 || !in_array($action, ['approve', 'remove', 'merge'], true)) {
    json_error('Invalid request.');
}

$stmt = $pdo->prepare('SELECT id, name, latitude, longitude, submitted_by, reviewed, image_path FROM stores WHERE id = ?');
$stmt->execute([$id]);
$store = $stmt->fetch();
if (!$store) {
    json_error('Stall not found.', 404);
}

const NEAR_NEW_STALL_KM = 10;   // people who were last seen within this distance hear about a new stall

/**
 * 5.11: tell the person who suggested the stall that it is approved.
 * 5.12: tell everyone who shared their location and is within ~10 km.
 * Both notifications open the stall on the map when clicked.
 */
function notify_approved(PDO $pdo, array $store): void
{
    $insert = $pdo->prepare(
        'INSERT INTO notifications (recipient_id, actor_id, type, message, location_label, target_type, target_id)
         VALUES (?, NULL, ?, ?, ?, \'store\', ?)'
    );
    $sid  = (int) $store['id'];
    $name = mb_substr((string) $store['name'], 0, 100);
    $submitter = $store['submitted_by'] !== null ? (int) $store['submitted_by'] : 0;

    if ($submitter > 0) {
        $insert->execute([$submitter, 'system', 'Your suggested stall was checked and now has the Verified badge.', $name, $sid]);
    }

    $users = $pdo->query('SELECT id, last_lat, last_lng FROM users WHERE last_lat IS NOT NULL AND last_lng IS NOT NULL LIMIT 5000')->fetchAll();
    foreach ($users as $u) {
        if ((int) $u['id'] === $submitter) continue;
        $km = distance_m((float) $store['latitude'], (float) $store['longitude'], (float) $u['last_lat'], (float) $u['last_lng']) / 1000;
        if ($km <= NEAR_NEW_STALL_KM) {
            $insert->execute([(int) $u['id'], 'spot', 'A new verified ukay stall is near you.', $name, $sid]);
        }
    }
}

/** Tell the person who suggested a still-pending stall that it was not added as new. */
function notify_declined(PDO $pdo, array $store, ?int $mergedInto): void
{
    $submitter = $store['submitted_by'] !== null ? (int) $store['submitted_by'] : 0;
    if ($submitter <= 0 || (int) $store['reviewed'] !== 0) return;
    $name = mb_substr((string) $store['name'], 0, 100);
    if ($mergedInto) {
        $pdo->prepare('INSERT INTO notifications (recipient_id, actor_id, type, message, location_label, target_type, target_id)
                       VALUES (?, NULL, \'system\', ?, ?, \'store\', ?)')
            ->execute([$submitter, 'That stall was already on the map, so your suggestion was merged into it.', $name, $mergedInto]);
    } else {
        $pdo->prepare('INSERT INTO notifications (recipient_id, actor_id, type, message, location_label)
                       VALUES (?, NULL, \'system\', ?, ?)')
            ->execute([$submitter, 'Your suggested stall could not be verified, so it was not added to the map.', $name]);
    }
}

/** Run a statement, ignoring "this optional table does not exist". */
function try_exec(PDO $pdo, string $sql, array $args): void
{
    try { $pdo->prepare($sql)->execute($args); }
    catch (PDOException $e) { error_log('admin/stall.php (optional step): ' . $e->getMessage()); }
}

function drop_photo(?string $path): void
{
    if ($path && strpos($path, 'uploads/') === 0) {
        @unlink(__DIR__ . '/../../' . $path);
    }
}

if ($action === 'approve') {
    $pdo->prepare('UPDATE stores SET reviewed = 1 WHERE id = ?')->execute([$id]);
    // Only the first approval sends notices (clicking Approve twice must not spam anyone)
    if ((int) $store['reviewed'] === 0) {
        try { notify_approved($pdo, $store); }
        catch (PDOException $e) { error_log('admin/stall.php notify: ' . $e->getMessage()); }
    }
    json_response(['message' => 'Stall approved.']);
}

$pdo->beginTransaction();
try {
    if ($action === 'merge') {
        if ($into <= 0 || $into === $id) {
            $pdo->rollBack();
            json_error('Pick a different stall to merge into.');
        }
        $stmt = $pdo->prepare('SELECT id, base_rating, base_count FROM stores WHERE id = ?');
        $stmt->execute([$into]);
        $target = $stmt->fetch();
        if (!$target) {
            $pdo->rollBack();
            json_error('The stall to merge into was not found.', 404);
        }

        $pdo->prepare('UPDATE hauls SET store_id = ? WHERE store_id = ?')->execute([$into, $id]);
        $pdo->prepare('UPDATE spot_ratings SET store_id = ? WHERE store_id = ?')->execute([$into, $id]);
        // a person who saved both stalls keeps just one save
        $pdo->prepare('DELETE FROM saved_spots WHERE store_id = ? AND user_id IN (SELECT user_id FROM (SELECT user_id FROM saved_spots WHERE store_id = ?) x)')
            ->execute([$id, $into]);
        $pdo->prepare('UPDATE saved_spots SET store_id = ? WHERE store_id = ?')->execute([$into, $id]);

        // same formula the app already uses: starting rating counts as base_count votes
        $stmt = $pdo->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(stars), 0) AS total FROM spot_ratings WHERE store_id = ?');
        $stmt->execute([$into]);
        $r = $stmt->fetch();
        $baseCount = (int) $target['base_count'];
        $count = $baseCount + (int) $r['n'];
        $rating = $count > 0 ? (((float) $target['base_rating'] * $baseCount) + (float) $r['total']) / $count : 0;
        $pdo->prepare('UPDATE stores SET rating = ?, rating_count = ? WHERE id = ?')
            ->execute([round(max(0, min(5, $rating)), 2), $count, $into]);
    } else {
        $pdo->prepare('DELETE FROM saved_spots WHERE store_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM spot_ratings WHERE store_id = ?')->execute([$id]);
        $pdo->prepare('UPDATE hauls SET store_id = NULL WHERE store_id = ?')->execute([$id]);
    }
    $pdo->prepare('DELETE FROM stores WHERE id = ?')->execute([$id]);
    $pdo->commit();
} catch (PDOException $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    throw $e;
}

try { notify_declined($pdo, $store, $action === 'merge' ? $into : null); }
catch (PDOException $e) { error_log('admin/stall.php decline notice: ' . $e->getMessage()); }

drop_photo($store['image_path']);
json_response(['message' => $action === 'merge' ? 'Stalls merged.' : 'Stall removed.']);