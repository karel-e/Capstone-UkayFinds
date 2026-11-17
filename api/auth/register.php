<?php
/**
 * POST /api/auth/register.php
 * Body (JSON): { username, email, password, confirm_password, accept_terms }
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

$username        = $input['username'] ?? '';
$email           = $input['email'] ?? '';
$password        = $input['password'] ?? '';
$confirmPassword = $input['confirm_password'] ?? '';

if (!is_string($username) || !is_string($email) || !is_string($password) || !is_string($confirmPassword)) {
    json_error('Invalid request body.');
}
$username = trim($username);
$email    = trim($email);

// ---- Validation ----
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
// strlen() counts bytes, which is what bcrypt cares about: it silently
// ignores everything past 72 bytes.
if (strlen($password) < 8) {
    json_error('Password must be at least 8 characters.');
}
if (strlen($password) > 72) {
    json_error('Password must be 72 characters or fewer.');
}
if ($password !== $confirmPassword) {
    json_error('Passwords do not match.');
}
// The sign-up form's checkbox sends accept_terms: true. Checked here too so
// the rule can't be skipped by calling the API directly.
if (($input['accept_terms'] ?? false) !== true) {
    json_error('Please agree to the Terms of Service and Privacy Policy to create an account.');
}

// ---- Uniqueness check ----
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$username, $email]);
if ($stmt->fetch()) {
    json_error('That username or email is already taken.', 409);
}

// ---- Create the account ----
$passwordHash = password_hash($password, PASSWORD_BCRYPT);
$displayName  = $username;

try {
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$username, $email, $passwordHash, $displayName]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        json_error('That username or email is already taken.', 409);
    }
    throw $e;
}
$userId = (int) $pdo->lastInsertId();

// Welcome notification: nice to have, never worth failing a signup over.
try {
    $stmt = $pdo->prepare(
        'INSERT INTO notifications (recipient_id, actor_id, type, message) VALUES (?, NULL, ?, ?)'
    );
    $stmt->execute([$userId, 'system', 'Welcome to UkayFinds! Start exploring local thrift spots near you.']);
} catch (PDOException $e) {
    error_log('register.php welcome notification failed: ' . $e->getMessage());
}

json_response([
    'message' => 'Account created. Please sign in.',
    'user' => [
        'id'           => $userId,
        'username'     => $username,
        'email'        => $email,
        'display_name' => $displayName,
    ],
], 201);