<?php
/**
 * GET /api/auth/me.php
 * "Who am I" — the frontend will call this once on page load to
 * decide whether to show the landing page or jump straight into
 * the dashboard for an already-logged-in visitor.
 *
 * Always returns 200 — "not logged in" is a normal state, not an
 * error, so it's { logged_in: false }, not a 401.
 */
require_once __DIR__ . '/../config.php';

if (empty($_SESSION['user_id'])) {
    json_response(['logged_in' => false]);
}

$stmt = $pdo->prepare('SELECT id, username, email, display_name, bio, location FROM users WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

if (!$user) {
    // The session pointed at a user that no longer exists (e.g. the
    // account was deleted) — clear the stale session instead of
    // leaving the visitor stuck.
    $_SESSION = [];
    session_destroy();
    json_response(['logged_in' => false]);
}

json_response(['logged_in' => true, 'user' => $user]);