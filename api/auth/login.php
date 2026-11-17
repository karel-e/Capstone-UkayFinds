<?php
/**
 * POST /api/auth/login.php
 * Body (JSON): { identifier, password }
 * "identifier" can be either a username or an email — matches your
 * signin modal's "Email or Username" field.
 *
 * Brute-force protection (6.12): 5 wrong passwords for the same username/email
 * in 15 minutes locks it for the rest of that window (HTTP 429). While locked,
 * the password isn't even checked. A correct login clears the count.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/_throttle.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}

$identifier = is_string($input['identifier'] ?? null) ? trim($input['identifier']) : '';
$password   = is_string($input['password'] ?? null) ? $input['password'] : '';

if ($identifier === '' || $password === '') {
    json_error('Enter your username/email and password.');
}

// Locked out? Answer 429 before doing any password work.
throttle_check($pdo, $identifier);

$stmt = $pdo->prepare(
    'SELECT id, username, email, display_name, bio, location, role, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

// Deliberately the same error message whether the account doesn't exist
// or the password is wrong — telling the two apart lets an attacker
// enumerate which usernames/emails are registered. Unknown accounts are
// counted too, so the lock-out can't be used to find real accounts either.
if (!$user || !password_verify($password, $user['password_hash'])) {
    throttle_fail($pdo, $identifier);
    json_error('Incorrect username/email or password.', 401);
}

throttle_clear($pdo, $identifier);

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];

unset($user['password_hash']);
json_response([
    'message' => 'Logged in.',
    'user'    => $user,
]);