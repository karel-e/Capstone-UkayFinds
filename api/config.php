<?php
/**
 * api/config.php
 * Shared bootstrap — every other file in /api starts with:
 *     require_once __DIR__ . '/config.php';
 *
 * 1. Loads machine-specific settings from config.local.php
 * 2. Sets error reporting (nothing is ever shown in the browser)
 * 3. Starts a hardened session
 * 4. Rejects cross-site POSTs (CSRF check)
 * 5. Opens one PDO connection
 * 6. Defines json_response() / json_error()
 */

// ---- 1. Local settings (passwords + keys live outside this file) ----
// config.local.php is NOT in version control. Ideally keep it above the web root
// and point to it with the UKAYFINDS_CONFIG environment variable.
$localFile = getenv('UKAYFINDS_CONFIG') ?: (__DIR__ . '/config.local.php');
$local = is_file($localFile) ? require $localFile : [];

define('APP_DEBUG', !empty($local['APP_DEBUG']));   // missing = false = safe by default
define('DB_HOST', $local['DB_HOST'] ?? 'localhost');
define('DB_NAME', $local['DB_NAME'] ?? 'ukayfinds');
define('DB_USER', $local['DB_USER'] ?? '');
define('DB_PASS', $local['DB_PASS'] ?? '');
// Optional full DSN override. Leave it out in real use (MySQL/MariaDB is used);
// tests/run_api_tests.php sets it to a throw-away SQLite file.
define('DB_DSN',  $local['DB_DSN']  ?? ('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4'));
// Extra website hosts allowed to POST to the API (normally none), e.g. ['www.ukayfinds.ph']
define('ALLOWED_HOSTS', $local['ALLOWED_HOSTS'] ?? []);
// Later phases: mail + AI keys are read from here too
define('MAIL_USER', $local['MAIL_USER'] ?? '');
define('MAIL_APP_PASSWORD', $local['MAIL_APP_PASSWORD'] ?? '');

// ---- 2. Error reporting ----
// Errors go to the PHP error log, never to the visitor. APP_DEBUG only affects
// the log noise level, it does NOT send exception text to the browser.
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');

// Any uncaught exception -> generic JSON, details only in the log
set_exception_handler(function (Throwable $e) {
    error_log('Uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    echo json_encode(['success' => false, 'error' => 'Something went wrong.']);
    exit;
});

// ---- 3. Session ----
// httponly: JavaScript can't read the cookie. SameSite=Lax: it isn't sent on
// cross-site POSTs. secure: only sent over HTTPS (switched on automatically when
// the site is opened over HTTPS, so http://localhost on XAMPP still works).
// use_strict_mode: the server refuses session ids it didn't create.
function request_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => request_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ---- 4. CSRF: refuse a POST that comes from another website ----
// Browsers always attach an Origin (or at least a Referer) header to a
// cross-site POST. If its host isn't this site, the request is rejected.
// Requests with neither header (curl, tests) can't come from a victim's browser.
function same_origin_ok(): bool
{
    $source = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($source === '' || $source === 'null') {
        return $source === '';
    }
    $parts = parse_url($source);
    if (!is_array($parts) || empty($parts['host'])) {
        return false;
    }
    $sourceHost = strtolower($parts['host']);
    $siteHost   = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    return $sourceHost === $siteHost || in_array($sourceHost, array_map('strtolower', ALLOWED_HOSTS), true);
}
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS'], true) && !same_origin_ok()) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Request blocked.']);
    exit;
}

// ---- 5. Database connection ----
try {
    $pdo = new PDO(
        DB_DSN,
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    error_log('DB connection failed: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Database connection failed.']);
    exit;
}

// ---- 6. Response helpers ----
header('Content-Type: application/json');

/**
 * Send a successful JSON response and stop execution.
 * Usage: json_response(['stores' => $rows]);
 */
function json_response(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

/**
 * Send an error JSON response and stop execution.
 * Usage: json_error('Store not found.', 404);
 */
function json_error(string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}