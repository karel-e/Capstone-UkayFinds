<?php
/**
 * POST /api/hauls/create.php
 * multipart/form-data:
 *   item_name, price?, store_name?, tags[]?, image? (file)
 *   status?   'draft' | 'published' (default 'published')
 *   draft_id? if set, updates that existing draft instead of inserting a new row
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to post a haul.', 401);
}
$userId = (int) $_SESSION['user_id'];

$isDraft   = ($_POST['status'] ?? '') === 'draft';
$draftId   = isset($_POST['draft_id']) ? (int) $_POST['draft_id'] : 0;
$itemName  = trim($_POST['item_name'] ?? '');
$price     = isset($_POST['price']) && $_POST['price'] !== '' ? (float) $_POST['price'] : null;
$storeName = trim($_POST['store_name'] ?? '');
$tags      = isset($_POST['tags']) ? (array) $_POST['tags'] : ['near-me'];
$hasUpload = !empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK;

// Continuing a draft? Make sure it's really this user's draft.
$existing = null;
if ($draftId > 0) {
    $stmt = $pdo->prepare("SELECT id, image_path FROM hauls WHERE id = ? AND user_id = ? AND status = 'draft'");
    $stmt->execute([$draftId, $userId]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_error('That draft no longer exists.', 404);
    }
}

if (mb_strlen($itemName) > 150) {
    json_error('Caption must be 150 characters or fewer.');
}

$hasImage = $hasUpload || ($existing && $existing['image_path']);
if ($isDraft) {
    if ($itemName === '' && !$hasImage) {
        json_error('Add a photo or a caption to save a draft.');
    }
} elseif ($itemName === '') {
    json_error('Add a caption for your haul.');
}

$storeId = null;
if ($storeName !== '') {
    $stmt = $pdo->prepare('SELECT id FROM stores WHERE name = ? LIMIT 1');
    $stmt->execute([$storeName]);
    $store = $stmt->fetch();
    if ($store) $storeId = (int) $store['id'];
}

// ---- Image upload (optional) ----
$imagePath = $existing['image_path'] ?? null;
if ($hasUpload) {
    $allowedTypes = ['image/png' => 'png', 'image/jpeg' => 'jpg'];
    $mimeType = mime_content_type($_FILES['image']['tmp_name']);

    if (!isset($allowedTypes[$mimeType])) {
        json_error('Only PNG and JPG images are allowed.');
    }
    if ($_FILES['image']['size'] > 5 * 1024 * 1024) {
        json_error('Image must be under 5MB.');
    }

    $uploadDir = __DIR__ . '/../../uploads/hauls/';
    $filename = 'haul_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $allowedTypes[$mimeType];

    if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $filename)) {
        // Replacing a draft's photo: remove the old file so it doesn't pile up
        if ($existing && $existing['image_path'] && strpos($existing['image_path'], 'uploads/') === 0) {
            @unlink(__DIR__ . '/../../' . $existing['image_path']);
        }
        $imagePath = 'uploads/hauls/' . $filename;
    }
}

$status = $isDraft ? 'draft' : 'published';

if ($existing) {
    // created_at refreshed so a draft published today shows up as new in the feed
    $stmt = $pdo->prepare(
        'UPDATE hauls SET store_id = ?, item_name = ?, price = ?, image_path = ?, status = ?, created_at = NOW()
         WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([$storeId, $itemName, $price, $imagePath, $status, $draftId, $userId]);
    $haulId = $draftId;
} else {
    $stmt = $pdo->prepare(
        'INSERT INTO hauls (user_id, store_id, item_name, price, image_path, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $storeId, $itemName, $price, $imagePath, $status]);
    $haulId = (int) $pdo->lastInsertId();
}

foreach ($tags as $tag) {
    $tag = trim($tag);
    if ($tag === '') continue;
    $stmt = $pdo->prepare('INSERT IGNORE INTO haul_tags (haul_id, tag) VALUES (?, ?)');
    $stmt->execute([$haulId, $tag]);
}

json_response(['haul_id' => $haulId]);