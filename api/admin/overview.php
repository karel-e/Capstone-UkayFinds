<?php
/**
 * GET /api/admin/overview.php   (admins only)
 * One call that fills the whole Admin dashboard:
 *   stats, stalls waiting for review (with a "possible duplicate of"),
 *   all stalls, open reports (grouped per haul/comment) and users.
 */
require_once __DIR__ . '/_guard.php';
require_admin($pdo);

const DUPLICATE_M = 150;   // another stall this close (or with the same name) = possible duplicate

function one(PDO $pdo, string $sql): int
{
    return (int) $pdo->query($sql)->fetchColumn();
}

$stats = [
    'stalls'  => one($pdo, 'SELECT COUNT(*) FROM stores'),
    'pending' => one($pdo, 'SELECT COUNT(*) FROM stores WHERE reviewed = 0'),
    'users'   => one($pdo, "SELECT COUNT(*) FROM users WHERE role = 'user'"),
    'hauls'   => one($pdo, "SELECT COUNT(*) FROM hauls WHERE status = 'published'"),
];

// ---- Stalls (waiting ones first) ----
$stalls = $pdo->query(
    'SELECT s.id, s.name, s.address, s.latitude, s.longitude, s.reviewed, s.rating, s.rating_count,
            s.image_path, s.created_at, u.username AS submitted_by_name
       FROM stores s
       LEFT JOIN users u ON u.id = s.submitted_by
      ORDER BY s.reviewed ASC, s.created_at DESC, s.id DESC
      LIMIT 300'
)->fetchAll();

foreach ($stalls as &$s) {
    $s['id'] = (int) $s['id'];
    $s['reviewed'] = (int) $s['reviewed'];
    $s['duplicate_of'] = null;
    if ($s['reviewed'] === 0) {
        foreach ($stalls as $other) {
            if ($other['id'] === $s['id']) continue;
            $sameName = mb_strtolower(trim($other['name'])) === mb_strtolower(trim($s['name']));
            $near = distance_m((float) $s['latitude'], (float) $s['longitude'],
                               (float) $other['latitude'], (float) $other['longitude']) <= DUPLICATE_M;
            if ($sameName || $near) {
                $s['duplicate_of'] = ['id' => (int) $other['id'], 'name' => $other['name']];
                break;
            }
        }
    }
}
unset($s);
$pending = array_values(array_filter($stalls, fn($s) => $s['reviewed'] === 0));

// ---- Open reports, grouped per target ----
$rows = $pdo->query(
    "SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, u.username AS reporter
       FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.status = 'open'
      ORDER BY r.created_at DESC"
)->fetchAll();

$groups = [];
foreach ($rows as $r) {
    $key = $r['target_type'] . ':' . $r['target_id'];
    if (!isset($groups[$key])) {
        $groups[$key] = [
            'target_type' => $r['target_type'],
            'target_id'   => (int) $r['target_id'],
            'count'       => 0,
            'reasons'     => [],
            'last_at'     => $r['created_at'],
        ];
    }
    $groups[$key]['count']++;
    $groups[$key]['reasons'][$r['reason']] = true;
}
$reports = [];
foreach ($groups as $g) {
    if ($g['target_type'] === 'haul') {
        $st = $pdo->prepare('SELECT h.item_name AS preview, u.username FROM hauls h JOIN users u ON u.id = h.user_id WHERE h.id = ?');
    } else {
        $st = $pdo->prepare('SELECT c.body AS preview, u.username FROM haul_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?');
    }
    $st->execute([$g['target_id']]);
    $t = $st->fetch();
    if (!$t) {
        // the haul/comment is already gone: close these reports quietly
        $pdo->prepare("UPDATE reports SET status = 'actioned' WHERE target_type = ? AND target_id = ?")
            ->execute([$g['target_type'], $g['target_id']]);
        continue;
    }
    $g['reasons'] = array_keys($g['reasons']);
    $g['preview'] = mb_substr($t['preview'], 0, 120);
    $g['author']  = $t['username'];
    $reports[] = $g;
}
usort($reports, fn($a, $b) => $b['count'] <=> $a['count']);
$stats['reports'] = count($reports);

// ---- Users ----
$users = $pdo->query(
    "SELECT u.id, u.username, u.display_name, u.role, u.created_at,
            (SELECT COUNT(*) FROM hauls h WHERE h.user_id = u.id AND h.status = 'published') AS hauls
       FROM users u ORDER BY u.created_at DESC, u.id DESC LIMIT 200"
)->fetchAll();
foreach ($users as &$u) { $u['hauls'] = (int) $u['hauls']; }
unset($u);

// ---- Published hauls (for the "Hauls posted" box) ----
$hauls = $pdo->query(
    "SELECT h.id, h.item_name, h.price, h.image_path, h.created_at, u.username, s.name AS store_name
       FROM hauls h
       JOIN users u ON u.id = h.user_id
       LEFT JOIN stores s ON s.id = h.store_id
      WHERE h.status = 'published'
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT 200"
)->fetchAll();
foreach ($hauls as &$h) { $h['price'] = $h['price'] !== null ? (float) $h['price'] : null; }
unset($h);

// ---- Ukay Trail numbers (zeros until migration_trail.sql has been run) ----
$trail = ['stamps_today' => 0, 'stamps_total' => 0, 'rewards' => 0];
try {
    $today = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
    $st = $pdo->prepare('SELECT COUNT(*) FROM trail_stamps WHERE stamp_date = ?');
    $st->execute([$today]);
    $trail['stamps_today'] = (int) $st->fetchColumn();
    $trail['stamps_total'] = one($pdo, 'SELECT COUNT(*) FROM trail_stamps');
    $trail['rewards']      = one($pdo, 'SELECT COUNT(*) FROM trail_rewards');
} catch (PDOException $e) {
    error_log('admin/overview.php trail: ' . $e->getMessage());
}

json_response([
    'stats'   => $stats,
    'trail'   => $trail,
    'pending' => $pending,
    'stalls'  => $stalls,
    'reports' => $reports,
    'users'   => $users,
    'hauls'   => $hauls,
]);