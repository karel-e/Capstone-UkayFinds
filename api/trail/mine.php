<?php
/**
 * GET /api/trail/mine.php   (login required)
 * The person's stamp card: every active trail with the stalls they visited,
 * how many more they need, and the reward code once they finish.
 */
require_once __DIR__ . '/_trail.php';

if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

$out = [];
foreach (trail_active($pdo) as $t) {
    $visited = trail_visited($pdo, $userId, $t);
    $stmt = $pdo->prepare('SELECT code, created_at FROM trail_rewards WHERE user_id = ? AND trail_id = ?');
    $stmt->execute([$userId, $t['id']]);
    $reward = $stmt->fetch();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM stores' . ($t['city'] !== '' ? ' WHERE address LIKE ?' : ''));
    $stmt->execute($t['city'] !== '' ? [trail_like($t['city'])] : []);

    $out[] = [
        'id'            => $t['id'],
        'name'          => $t['name'],
        'city'          => $t['city'],
        'stamps_needed' => $t['stamps_needed'],
        'reward_text'   => $t['reward_text'],
        'stalls_on_trail' => (int) $stmt->fetchColumn(),
        'visited'       => $visited,
        'count'         => count($visited),
        'complete'      => count($visited) >= $t['stamps_needed'],
        'reward_code'   => $reward ? $reward['code'] : null,
    ];
}

$stmt = $pdo->prepare('SELECT DISTINCT store_id FROM trail_stamps WHERE user_id = ?');
$stmt->execute([$userId]);
$stampedIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

json_response(['trails' => $out, 'stamped_ids' => $stampedIds]);