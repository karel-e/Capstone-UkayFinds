<?php
/**
 * POST /api/profile/update.php
 * Body (JSON): { display_name, bio, location }
 * Login required. The username (@handle) is deliberately NOT editable here:
 * it is the login name and has to stay unique.
 * Returns the saved user so the page can refresh the header and profile card.
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
    exit;
}
$userId = (int) $_SESSION['user_id'];

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    json_error('Invalid request body — expected JSON.');
}

// One tidy line each: no tabs/newlines, no doubled spaces
function clean_line($value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    return trim(preg_replace('/\s+/u', ' ', $value));
}

$displayName = clean_line($input['display_name'] ?? '');
$bio         = clean_line($input['bio'] ?? '');
$location    = clean_line($input['location'] ?? '');

if ($displayName === null || $bio === null || $location === null) {
    json_error('Invalid profile data.');
}
if ($displayName === '') {
    json_error('Your name can\'t be empty.');
}
if (mb_strlen($displayName) > 50) {
    json_error('Name must be 50 characters or fewer.');
}
if (mb_strlen($bio) > 160) {
    json_error('Bio must be 160 characters or fewer.');
}
if (mb_strlen($location) > 60) {
    json_error('Location must be 60 characters or fewer.');
}

$stmt = $pdo->prepare('UPDATE users SET display_name = ?, bio = ?, location = ? WHERE id = ?');
$stmt->execute([
    $displayName,
    $bio !== '' ? $bio : null,
    $location !== '' ? $location : null,
    $userId,
]);

$stmt = $pdo->prepare('SELECT id, username, email, display_name, bio, location FROM users WHERE id = ?');
$stmt->execute([$userId]);

json_response(['message' => 'Profile saved.', 'user' => $stmt->fetch()]);