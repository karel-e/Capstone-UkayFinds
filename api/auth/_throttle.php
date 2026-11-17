<?php
/**
 * api/auth/_throttle.php  — brute-force protection for login (roadmap 6.12)
 *
 * Failed logins are written to login_attempts. Once an account (or one IP
 * address) has too many failures in the last 15 minutes, login answers 429 and
 * does not even check the password. A good login clears that account's failures.
 *
 *   throttle_check($pdo, $identifier)   -> call BEFORE password_verify
 *   throttle_fail($pdo, $identifier)    -> call after a wrong password / unknown user
 *   throttle_clear($pdo, $identifier)   -> call after a successful login
 */
const THROTTLE_WINDOW_SEC   = 900;   // 15 minutes
const THROTTLE_MAX_ACCOUNT  = 5;     // wrong tries per username/email
const THROTTLE_MAX_IP       = 20;    // wrong tries per IP (higher: many students share one school/campus wifi)

function throttle_key(string $identifier): string
{
    return mb_substr(mb_strtolower(trim($identifier)), 0, 190);
}

function throttle_ip(): string
{
    return mb_substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

/** Seconds the visitor must still wait, or 0 if they may try. */
function throttle_wait(PDO $pdo, string $identifier): int
{
    $since = date('Y-m-d H:i:s', time() - THROTTLE_WINDOW_SEC);
    $now   = time();
    $wait  = 0;

    $checks = [
        ['SELECT COUNT(*) AS n, MIN(attempted_at) AS first FROM login_attempts WHERE identifier = ? AND attempted_at > ?',
         [throttle_key($identifier), $since], THROTTLE_MAX_ACCOUNT],
        ['SELECT COUNT(*) AS n, MIN(attempted_at) AS first FROM login_attempts WHERE ip = ? AND attempted_at > ?',
         [throttle_ip(), $since], THROTTLE_MAX_IP],
    ];
    foreach ($checks as [$sql, $args, $max]) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($args);
        $row = $stmt->fetch();
        if ((int) $row['n'] >= $max) {
            // the lock lifts when the oldest counted failure leaves the 15-minute window
            $wait = max($wait, strtotime($row['first']) + THROTTLE_WINDOW_SEC - $now);
        }
    }
    return max(0, $wait);
}

/** Stop the request with HTTP 429 if this visitor is locked out. */
function throttle_check(PDO $pdo, string $identifier): void
{
    $wait = throttle_wait($pdo, $identifier);
    if ($wait > 0) {
        $minutes = max(1, (int) ceil($wait / 60));
        header('Retry-After: ' . $wait);
        json_error('Too many failed attempts. Try again in ' . $minutes . ' minute' . ($minutes === 1 ? '' : 's') . '.', 429);
    }
}

function throttle_fail(PDO $pdo, string $identifier): void
{
    $pdo->prepare('INSERT INTO login_attempts (identifier, ip, attempted_at) VALUES (?, ?, ?)')
        ->execute([throttle_key($identifier), throttle_ip(), date('Y-m-d H:i:s')]);
    // tidy up: nothing older than a day is ever needed
    $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < ?')
        ->execute([date('Y-m-d H:i:s', time() - 86400)]);
}

function throttle_clear(PDO $pdo, string $identifier): void
{
    $pdo->prepare('DELETE FROM login_attempts WHERE identifier = ?')->execute([throttle_key($identifier)]);
}