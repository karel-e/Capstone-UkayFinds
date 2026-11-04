<?php
/**
 * POST /api/comments/delete.php
 * Body (JSON): { id }
 * A comment can only be deleted by the person who wrote it.
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

// The user_id in the WHERE clause is what stops anyone else deleting it
$stmt = $pdo->prepare('DELETE FROM haul_comments WHERE id = ? AND user_id = ?');
$stmt->execute([$id, $userId]);
if ($stmt->rowCount() === 0) {
    json_error('Comment not found.', 404);
}

json_response([]);