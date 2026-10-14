<?php
/**
 * POST /api/auth/login.php
 * Body (JSON): { identifier, password }
 * "identifier" can be either a username or an email — matches your
 * signin modal's "Email or Username" field.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}

$identifier = trim($input['identifier'] ?? '');
$password   = $input['password'] ?? '';

if ($identifier === '' || $password === '') {
    json_error('Enter your username/email and password.');
}

$stmt = $pdo->prepare(
    'SELECT id, username, email, display_name, bio, location, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

// Deliberately the same error message whether the account doesn't exist
// or the password is wrong — telling the two apart lets an attacker
// enumerate which usernames/emails are registered.
if (!$user || !password_verify($password, $user['password_hash'])) {
    json_error('Incorrect username/email or password.', 401);
}

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];

unset($user['password_hash']);
json_response([
    'message' => 'Logged in.',
    'user'    => $user,
]);