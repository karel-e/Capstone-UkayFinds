<?php
/**
 * POST /api/drafts/delete.php
 * Body (JSON): { type: 'haul', id }
 * Only ever deletes the caller's own drafts, never published items.
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('Not logged in.', 401);
}
$userId = (int) $_SESSION['user_id'];

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$type  = $input['type'] ?? '';
$id    = isset($input['id']) ? (int) $input['id'] : 0;

// Only haul drafts exist now; the table name is fixed, never taken from the request
$table = 'hauls';
if ($type !== 'haul' || $id <= 0) {
    json_error('Invalid request.');
}

$stmt = $pdo->prepare("SELECT image_path FROM $table WHERE id = ? AND user_id = ? AND status = 'draft'");
$stmt->execute([$id, $userId]);
$row = $stmt->fetch();
if (!$row) {
    json_error('Draft not found.', 404);
}

$stmt = $pdo->prepare("DELETE FROM $table WHERE id = ? AND user_id = ? AND status = 'draft'");
$stmt->execute([$id, $userId]);

if ($row['image_path'] && strpos($row['image_path'], 'uploads/') === 0) {
    @unlink(__DIR__ . '/../../' . $row['image_path']);
}

json_response([]);