<?php
/**
 * POST /api/saved-hauls/toggle.php
 * Body (JSON): { haul_id }
 * Saves or unsaves a published haul for the logged-in user and returns
 * { saved: true|false }.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

$input  = json_decode(file_get_contents('php://input'), true);
$haulId = (is_array($input) && isset($input['haul_id'])) ? (int) $input['haul_id'] : 0;
if ($haulId <= 0) {
    json_error('Invalid request.');
}

$stmt = $pdo->prepare("SELECT id FROM hauls WHERE id = ? AND status = 'published'");
$stmt->execute([$haulId]);
if (!$stmt->fetch()) {
    json_error('Haul not found.', 404);
}

try {
    // Already saved? Then this click is an unsave.
    $stmt = $pdo->prepare('DELETE FROM saved_hauls WHERE user_id = ? AND haul_id = ?');
    $stmt->execute([$userId, $haulId]);

    if ($stmt->rowCount() > 0) {
        $saved = false;
    } else {
        // INSERT IGNORE + the unique key means a double-click can't create two rows
        $stmt = $pdo->prepare('INSERT IGNORE INTO saved_hauls (user_id, haul_id) VALUES (?, ?)');
        $stmt->execute([$userId, $haulId]);
        $saved = true;
    }
} catch (PDOException $e) {
    error_log('saved-hauls/toggle.php: ' . $e->getMessage());
    json_error('Could not update your saved items.', 500);
}

json_response(['saved' => $saved]);