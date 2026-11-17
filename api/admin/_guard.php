<?php
/**
 * api/admin/_guard.php
 * Shared by every file in api/admin/. Call require_admin($pdo) first: it
 * answers 401 (not logged in) or 403 (logged in but not an admin) and stops.
 * The role is read from the database on every request, never from the
 * session, so removing someone's admin role takes effect immediately.
 */
require_once __DIR__ . '/../config.php';

function require_admin(PDO $pdo): int
{
    if (empty($_SESSION['user_id'])) {
        json_error('Not logged in.', 401);
    }
    $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    if ($stmt->fetchColumn() !== 'admin') {
        json_error('Admins only.', 403);
    }
    return (int) $_SESSION['user_id'];
}

/** Distance in metres between two lat/lng points (used to spot duplicate stalls). */
function distance_m(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $r = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return 2 * $r * asin(min(1, sqrt($a)));
}