<?php
/**
 * POST /api/auth/register.php
 * Body (JSON): { username, email, password, confirm_password }
 * On success: creates the account, logs the user in immediately
 * (same as your current fake signup flow does), and returns the
 * new user's public fields.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}

$username        = trim($input['username'] ?? '');
$email           = trim($input['email'] ?? '');
$password        = $input['password'] ?? '';
$confirmPassword = $input['confirm_password'] ?? '';

// ---- Validation (mirrors the checks your signup modal already does
// client-side — but the server-side copy is the one that actually
// matters, since anyone can bypass the JS and call this URL directly) ----
if ($username === '' || $email === '' || $password === '' || $confirmPassword === '') {
    json_error('All fields are required.');
}
if (strlen($username) < 3 || strlen($username) > 30) {
    json_error('Username must be between 3 and 30 characters.');
}
if (!preg_match('/^[a-zA-Z0-9_.]+$/', $username)) {
    json_error('Username can only contain letters, numbers, periods, and underscores.');
}
if (!preg_match('/[a-zA-Z]/', $username)) {
    json_error('Username must contain at least one letter.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('Enter a valid email address.');
}
if (strlen($password) < 6) {
    json_error('Password must be at least 6 characters.');
}
if ($password !== $confirmPassword) {
    json_error('Passwords do not match.');
}

// ---- Uniqueness check ----
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$username, $email]);
if ($stmt->fetch()) {
    json_error('That username or email is already taken.', 409);
}

// ---- Create the account ----
// Deliberately NOT logging the account in here — registering only creates
// it. The user still has to prove they know the password by going through
// Sign In separately, same as almost every real signup flow works.
$passwordHash = password_hash($password, PASSWORD_BCRYPT);
$displayName  = $username; // they can change this later via Edit Profile

$stmt = $pdo->prepare(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
);
$stmt->execute([$username, $email, $passwordHash, $displayName]);
$userId = (int) $pdo->lastInsertId();

// Welcome notification — actor_id is NULL because this comes from the
// system itself, not another user. Failure here shouldn't block registration,
// so it isn't wrapped in the same validation/error flow as the checks above.
$stmt = $pdo->prepare(
    'INSERT INTO notifications (recipient_id, actor_id, type, message) VALUES (?, NULL, ?, ?)'
);
$stmt->execute([$userId, 'system', 'Welcome to UkayFinds! Start exploring local thrift spots near you.']);

json_response([
    'message' => 'Account created. Please sign in.',
    'user' => [
        'id'           => $userId,
        'username'     => $username,
        'email'        => $email,
        'display_name' => $displayName,
    ],
], 201);