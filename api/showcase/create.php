<?php
/**
 * POST /api/showcase/create.php
 * multipart/form-data:
 *   item_name, description, selling_method, image? (file)
 *   bid_start_price?, bid_increment?, lock_price?, grab_price?, mine_price?
 *   status?   'draft' | 'active' (default 'active')
 *   draft_id? if set, updates that existing draft instead of inserting a new row
 */
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to post a showcase item.', 401);
}
$userId = (int) $_SESSION['user_id'];

$isDraft       = ($_POST['status'] ?? '') === 'draft';
$draftId       = isset($_POST['draft_id']) ? (int) $_POST['draft_id'] : 0;
$itemName      = trim($_POST['item_name'] ?? '');
$description   = trim($_POST['description'] ?? '');
$sellingMethod = $_POST['selling_method'] ?? '';
$hasUpload     = !empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK;

$existing = null;
if ($draftId > 0) {
    $stmt = $pdo->prepare("SELECT id, image_path FROM showcase_listings WHERE id = ? AND user_id = ? AND status = 'draft'");
    $stmt->execute([$draftId, $userId]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_error('That draft no longer exists.', 404);
    }
}

if (mb_strlen($itemName) > 150) {
    json_error('Item name must be 150 characters or fewer.');
}
if (mb_strlen($description) > 500) {
    json_error('Description must be 500 characters or fewer.');
}

if (!in_array($sellingMethod, ['bidding', 'lock', 'grab', 'mine'], true)) {
    if ($isDraft) {
        $sellingMethod = 'bidding';
    } else {
        json_error('Invalid selling method.');
    }
}

$num = fn(string $key) => (isset($_POST[$key]) && $_POST[$key] !== '') ? (float) $_POST[$key] : null;
$bidStart     = $num('bid_start_price');
$bidIncrement = $num('bid_increment');
$lockPrice    = $num('lock_price');
$grabPrice    = $num('grab_price');
$minePrice    = $num('mine_price');

$hasImage = $hasUpload || ($existing && $existing['image_path']);
if ($isDraft) {
    if ($itemName === '' && !$hasImage) {
        json_error('Add a photo or an item name to save a draft.');
    }
} else {
    if ($itemName === '') {
        json_error('Give your listing a name first.');
    }
    if ($sellingMethod === 'bidding' && ($bidStart === null || $bidIncrement === null)) {
        json_error('Enter both a starting price and a bid increment.');
    }
    if ($sellingMethod === 'lock' && $lockPrice === null) {
        json_error('Enter a lock price.');
    }
    if ($sellingMethod === 'grab' && $grabPrice === null) {
        json_error('Enter a grab price.');
    }
    if ($sellingMethod === 'mine' && $minePrice === null) {
        json_error('Enter a mine price.');
    }
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

    $uploadDir = __DIR__ . '/../../uploads/showcase/';
    $filename = 'showcase_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $allowedTypes[$mimeType];

    if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $filename)) {
        if ($existing && $existing['image_path'] && strpos($existing['image_path'], 'uploads/') === 0) {
            @unlink(__DIR__ . '/../../' . $existing['image_path']);
        }
        $imagePath = 'uploads/showcase/' . $filename;
    }
}

$status = $isDraft ? 'draft' : 'active';
$descriptionValue = $description !== '' ? $description : null;

if ($existing) {
    $stmt = $pdo->prepare('
        UPDATE showcase_listings
        SET item_name = ?, description = ?, image_path = ?, selling_method = ?,
            bid_start_price = ?, bid_increment = ?, lock_price = ?, grab_price = ?, mine_price = ?,
            status = ?, created_at = NOW()
        WHERE id = ? AND user_id = ?
    ');
    $stmt->execute([
        $itemName, $descriptionValue, $imagePath, $sellingMethod,
        $bidStart, $bidIncrement, $lockPrice, $grabPrice, $minePrice,
        $status, $draftId, $userId,
    ]);
    $listingId = $draftId;
} else {
    $stmt = $pdo->prepare('
        INSERT INTO showcase_listings
            (user_id, item_name, description, image_path, selling_method,
             bid_start_price, bid_increment, lock_price, grab_price, mine_price, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $userId, $itemName, $descriptionValue, $imagePath, $sellingMethod,
        $bidStart, $bidIncrement, $lockPrice, $grabPrice, $minePrice, $status,
    ]);
    $listingId = (int) $pdo->lastInsertId();
}

json_response(['listing_id' => $listingId]);