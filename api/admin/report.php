<?php
/**
 * POST /api/admin/report.php   (admins only)
 * Body (JSON): { target_type: "haul" | "comment", target_id, action: "remove" | "dismiss" }
 *   remove  : the haul (with its likes, tags, comments, photo) or the comment is deleted
 *   dismiss : the content stays; the reports on it are closed
 */
require_once __DIR__ . '/_guard.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
require_admin($pdo);

$input  = json_decode(file_get_contents('php://input'), true);
$type   = (is_array($input) && isset($input['target_type'])) ? (string) $input['target_type'] : '';
$tid    = (is_array($input) && isset($input['target_id'])) ? (int) $input['target_id'] : 0;
$action = (is_array($input) && isset($input['action'])) ? (string) $input['action'] : '';
if (!in_array($type, ['haul', 'comment'], true) || $tid <= 0 || !in_array($action, ['remove', 'dismiss'], true)) {
    json_error('Invalid request.');
}

if ($action === 'remove') {
    $photo = null;
    $pdo->beginTransaction();
    try {
        if ($type === 'haul') {
            $stmt = $pdo->prepare('SELECT image_path FROM hauls WHERE id = ?');
            $stmt->execute([$tid]);
            $photo = $stmt->fetchColumn() ?: null;
            // children first, so this works whether or not the foreign keys cascade
            $pdo->prepare('DELETE FROM haul_likes WHERE haul_id = ?')->execute([$tid]);
            $pdo->prepare('DELETE FROM haul_tags WHERE haul_id = ?')->execute([$tid]);
            $commentIds = $pdo->prepare('SELECT id FROM haul_comments WHERE haul_id = ?');
            $commentIds->execute([$tid]);
            foreach ($commentIds->fetchAll(PDO::FETCH_COLUMN) as $cid) {
                $pdo->prepare("UPDATE reports SET status = 'actioned' WHERE target_type = 'comment' AND target_id = ?")->execute([$cid]);
            }
            $pdo->prepare('DELETE FROM haul_comments WHERE haul_id = ?')->execute([$tid]);
            $pdo->prepare('DELETE FROM hauls WHERE id = ?')->execute([$tid]);
        } else {
            $pdo->prepare('DELETE FROM haul_comments WHERE id = ?')->execute([$tid]);
        }
        $pdo->prepare("UPDATE reports SET status = 'actioned' WHERE target_type = ? AND target_id = ?")->execute([$type, $tid]);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        throw $e;
    }
    if ($photo && strpos($photo, 'uploads/') === 0) {
        @unlink(__DIR__ . '/../../' . $photo);
    }
    json_response(['message' => ucfirst($type) . ' removed.']);
}

$pdo->prepare("UPDATE reports SET status = 'dismissed' WHERE target_type = ? AND target_id = ? AND status = 'open'")
    ->execute([$type, $tid]);
json_response(['message' => 'Reports dismissed.']);