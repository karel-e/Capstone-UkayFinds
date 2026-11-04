<?php
/**
 * GET /api/users/search.php?q=ma
 * Finds people for the Community Feed search box. Login required.
 * At least 2 characters, at most 8 results. Returns ONLY username,
 * display_name and the number of published hauls - never email or location.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
    exit;
}

$q = (isset($_GET['q']) && is_string($_GET['q'])) ? trim(mb_substr($_GET['q'], 0, 60)) : '';
if (mb_strlen($q) < 2) {
    json_response(['users' => []]);
    exit;
}

// Escape \ % and _ so what the person types is searched literally
$like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%';

$stmt = $pdo->prepare("
    SELECT u.username, u.display_name,
           (SELECT COUNT(*) FROM hauls h WHERE h.user_id = u.id AND h.status = 'published') AS haul_count
    FROM users u
    WHERE u.username LIKE ? OR u.display_name LIKE ?
    ORDER BY haul_count DESC, u.username ASC
    LIMIT 8
");
$stmt->execute([$like, $like]);
$users = $stmt->fetchAll();

foreach ($users as &$u) {
    $u['haul_count'] = (int) $u['haul_count'];
}
unset($u);

json_response(['users' => $users]);