<?php
/**
 * Shared helpers for api/trail/*.php.
 * A stall counts toward a trail when its address contains the trail's city
 * (a trail with an empty city counts every stall).
 */
require_once __DIR__ . '/../config.php';

const CHECKIN_RADIUS_M = 150;   // how close you must be to the stall
const MAX_GPS_SLACK_M  = 100;   // phones indoors are off by a bit: allow the reported accuracy, up to this much

function trail_today(): string
{
    return (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
}

function trail_distance_m(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $r = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return 2 * $r * asin(min(1, sqrt($a)));
}

/** Escape LIKE wildcards in a city name. */
function trail_like(string $city): string
{
    return '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $city) . '%';
}

/** Distinct stalls this user has stamped that belong to the trail. Returns [ [store_id, name, first_date], ... ]. */
function trail_visited(PDO $pdo, int $userId, array $trail): array
{
    $sql = 'SELECT s.store_id, st.name, MIN(s.stamp_date) AS first_date
              FROM trail_stamps s JOIN stores st ON st.id = s.store_id
             WHERE s.user_id = ?';
    $args = [$userId];
    if ($trail['city'] !== '') {
        $sql .= ' AND st.address LIKE ?';
        $args[] = trail_like($trail['city']);
    }
    $sql .= ' GROUP BY s.store_id, st.name ORDER BY MIN(s.stamp_date) ASC, s.store_id ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['store_id'] = (int) $r['store_id']; }
    unset($r);
    return $rows;
}

function trail_active(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, name, city, stamps_needed, reward_text FROM trails WHERE active = 1 ORDER BY id')->fetchAll();
    foreach ($rows as &$t) { $t['id'] = (int) $t['id']; $t['stamps_needed'] = (int) $t['stamps_needed']; }
    unset($t);
    return $rows;
}