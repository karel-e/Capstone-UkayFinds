<?php
/**
 * POST /api/auth/logout.php
 * Clears the session. POST only, so another website can't log a user out
 * just by embedding <img src=".../logout.php"> (a GET would allow that).
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}

$_SESSION = [];

// Expire the session cookie in the browser too, not just the server-side data.
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 42000,
        'path'     => $p['path'],
        'domain'   => $p['domain'],
        'secure'   => $p['secure'],
        'httponly' => $p['httponly'],
        'samesite' => $p['samesite'] ?: 'Lax',
    ]);
}

session_destroy();

json_response(['message' => 'Logged out.']);