<?php
/**
 * POST /api/showcase/delete.php
 * Body (JSON): { id }
 * Deletes one of the logged-in user's own ACTIVE showcase listings and its
 * photo file. (Drafts are deleted through drafts/delete.php.)
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

$input = json_decode(file_get_contents('php://input'), true);
$id = (is_array($input) && isset($input['id'])) ? (int) $input['id'] : 0;
if ($id <= 0) {
    json_error('Invalid request.');
}

$stmt = $pdo->prepare("SELECT image_path FROM showcase_listings WHERE id = ? AND user_id = ? AND status = 'active'");
$stmt->execute([$id, $userId]);
$row = $stmt->fetch();
if (!$row) {
    json_error('Listing not found.', 404);
}

$pdo->prepare('DELETE FROM showcase_listings WHERE id = ? AND user_id = ?')->execute([$id, $userId]);

if ($row['image_path'] && strpos($row['image_path'], 'uploads/') === 0) {
    @unlink(__DIR__ . '/../../' . $row['image_path']);
}

json_response([]);