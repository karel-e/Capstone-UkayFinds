<?php
/**
 * GET /api/stores/list.php
 *
 * Query params (all optional):
 *   search=ukay              — filter by name, case-insensitive partial match
 *   sort=nearby|rating        — controls ORDER within whatever set of stores
 *                                gets returned; "nearby" needs lat & lng
 *   lat=10.38&lng=123.95      — visitor's current coordinates (from
 *                                navigator.geolocation) — when present, this
 *                                does more than sorting: results are FILTERED
 *                                to roughly a 30-minute ride, not just ordered
 *   random=1                  — used when we have neither a location nor a
 *                                real sort choice yet (e.g. permission was
 *                                just denied) — shuffles instead of always
 *                                returning the same fixed order
 *
 * No login required — anyone should be able to browse stores.
 */
require_once __DIR__ . '/../config.php';

$search = trim($_GET['search'] ?? '');
$sort   = $_GET['sort'] ?? 'rating';
$lat    = isset($_GET['lat']) ? (float) $_GET['lat'] : null;
$lng    = isset($_GET['lng']) ? (float) $_GET['lng'] : null;
$random = !empty($_GET['random']);

$sql = 'SELECT id, name, latitude, longitude, status_text, rating, rating_count, price_range, address FROM stores';
$params = [];

if ($search !== '') {
    $sql .= ' WHERE name LIKE ?';
    $params[] = '%' . $search . '%';
}

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$stores = $stmt->fetchAll();

// Which of these stores has the logged-in user saved? Lets the frontend draw
// the bookmark filled on first load instead of only after a click.
$savedIds = [];
if (!empty($_SESSION['user_id'])) {
    $stmt = $pdo->prepare('SELECT store_id FROM saved_spots WHERE user_id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $savedIds = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

/**
 * Great-circle distance between two lat/lng points, in kilometers.
 * This is the actual math behind "X km from your location" — straight-line
 * (Pythagorean) distance would be wrong here because lat/lng are angles on
 * a sphere, not flat x/y coordinates.
 */
function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $earthRadiusKm = 6371;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earthRadiusKm * $c;
}

foreach ($stores as &$store) {
    $store['id']            = (int) $store['id'];
    $store['is_saved'] = in_array($store['id'], $savedIds, true);
    $store['rating']        = (float) $store['rating'];
    $store['rating_count']  = (int) $store['rating_count'];
    $store['latitude']      = (float) $store['latitude'];
    $store['longitude']     = (float) $store['longitude'];

    if ($lat !== null && $lng !== null) {
        $distanceKm = haversineKm($lat, $lng, $store['latitude'], $store['longitude']);
        $store['distance_km']    = round($distanceKm, 2);
        $store['distance_label'] = $distanceKm < 1
            ? round($distanceKm * 1000) . 'm from your location'
            : round($distanceKm, 1) . 'km from your location';
    } else {
        // No coordinates supplied (visitor hasn't shared location) — fall
        // back to whatever descriptive address text the store has.
        $store['distance_km']    = null;
        $store['distance_label'] = $store['address'];
    }
}
unset($store); // break the reference from the foreach loop — good practice,
                // avoids a subtle bug if this array gets looped over again later

$radiusExpanded = false; // true only if we had to ignore the ride-radius limit
                          // because literally nothing was inside it

if ($lat !== null && $lng !== null) {
    // Known location: this is a real FILTER, not just a sort — anything
    // farther than a rough "30-minute ride" gets excluded entirely.
    //
    // There's no real routing/traffic data behind this (that needs a paid
    // API like Google Distance Matrix) — it's a straight-line distance
    // converted using an assumed average local speed. 20 km/h is a rough
    // stand-in for tricycle/habal-habal pace with stops and traffic, not
    // highway driving. Actual travel time will vary with real roads.
    $avgRideSpeedKmh = 20;
    $maxRideMinutes  = 30;
    $maxRideKm = $avgRideSpeedKmh * ($maxRideMinutes / 60); // = 10 km

    $nearby = array_values(array_filter($stores, fn($s) => $s['distance_km'] <= $maxRideKm));

    if (count($nearby) > 0) {
        $stores = $nearby;
    } else {
        // Nothing at all within range — better to show the closest options
        // anyway than to show an empty screen. The frontend uses this flag
        // to display an honest note about why.
        $radiusExpanded = true;
    }

    // Filtering and ordering are separate concerns: which stores make the
    // cut is decided above; which order they display in still respects
    // whatever the "Sort by" dropdown says.
    if ($sort === 'rating') {
        usort($stores, fn($a, $b) => $b['rating'] <=> $a['rating']);
    } else {
        usort($stores, fn($a, $b) => $a['distance_km'] <=> $b['distance_km']);
    }
} elseif ($random) {
    shuffle($stores);
} else {
    usort($stores, fn($a, $b) => $b['rating'] <=> $a['rating']);
}

json_response([
    'stores'          => $stores,
    'radius_expanded' => $radiusExpanded,
]);