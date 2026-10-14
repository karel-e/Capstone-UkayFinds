<?php
/**
 * POST /api/saved-spots/toggle.php
 * Body: { store_id }
 * Saves the spot if not already saved, unsaves it if it is —
 * one endpoint for both directions, since the frontend just needs
 * "flip the saved state" rather than two separate calls.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_response(['success' => false, 'error' => 'Not logged in.']);
    exit;
}
$userId = (int) $_SESSION['user_id'];

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$storeId = isset($input['store_id']) ? (int) $input['store_id'] : 0;

if ($storeId <= 0) {
    json_response(['success' => false, 'error' => 'Missing store_id.']);
    exit;
}

$stmt = $pdo->prepare('SELECT 1 FROM saved_spots WHERE user_id = ? AND store_id = ?');
$stmt->execute([$userId, $storeId]);

if ($stmt->fetch()) {
    $stmt = $pdo->prepare('DELETE FROM saved_spots WHERE user_id = ? AND store_id = ?');
    $stmt->execute([$userId, $storeId]);
    json_response(['success' => true, 'saved' => false]);
} else {
    $stmt = $pdo->prepare('INSERT INTO saved_spots (user_id, store_id) VALUES (?, ?)');
    $stmt->execute([$userId, $storeId]);
    json_response(['success' => true, 'saved' => true]);
}