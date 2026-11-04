<?php
/**
 * GET /api/saved-hauls/ids.php
 * Returns the ids of the hauls the logged-in user has saved: { ids: [..] }
 * The feed uses this to label each menu "Save item" or "Unsave item".
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

try {
    $stmt = $pdo->prepare('SELECT haul_id FROM saved_hauls WHERE user_id = ?');
    $stmt->execute([$userId]);
    $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
} catch (PDOException $e) {
    error_log('saved-hauls/ids.php: ' . $e->getMessage());
    json_error('Could not load your saved items.', 500);
}

json_response(['ids' => $ids]);