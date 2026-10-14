<?php
/**
 * /api/auth/logout.php
 * Clears the session. Matches your header dropdown's "Log Out" link.
 */
require_once __DIR__ . '/../config.php';

$_SESSION = [];
session_destroy();

json_response(['message' => 'Logged out.']);