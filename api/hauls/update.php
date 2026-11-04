<?php
/**
 * POST /api/hauls/update.php
 * multipart/form-data:
 *   haul_id, item_name, price?, store_id?, size?, color?, fabric?, image? (file, replaces the photo)
 * Edits one of the logged-in user's own PUBLISHED hauls. Drafts are saved
 * through create.php (draft_id), not here.
 */
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Use POST.', 405);
}
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['user_id'])) {
    json_error('You must be logged in to edit a haul.', 401);
}
$userId = (int) $_SESSION['user_id'];

// A file bigger than PHP's post_max_size arrives with $_POST and $_FILES both empty
if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json_error('That upload is too large.', 413);
}

$haulId     = isset($_POST['haul_id']) ? (int) $_POST['haul_id'] : 0;
$itemName   = trim((string) ($_POST['item_name'] ?? ''));
$price      = isset($_POST['price']) && $_POST['price'] !== '' ? (float) $_POST['price'] : null;
$storeIdRaw = trim((string) ($_POST['store_id'] ?? ''));
$size       = trim((string) ($_POST['size'] ?? ''));
$color      = trim((string) ($_POST['color'] ?? ''));
$fabric     = trim((string) ($_POST['fabric'] ?? ''));

// Ownership: the WHERE clause on user_id is what stops other accounts
$stmt = $pdo->prepare("SELECT id, image_path FROM hauls WHERE id = ? AND user_id = ? AND status = 'published'");
$stmt->execute([$haulId, $userId]);
$existing = $stmt->fetch();
if (!$existing) {
    json_error('Haul not found.', 404);
}

if ($itemName === '') {
    json_error('Add a caption for your haul.');
}
if (mb_strlen($itemName) > 500) {
    json_error('Caption must be 500 characters or fewer.');
}
if ($price !== null && ($price < 0 || $price > 99999999)) {
    json_error('Enter a valid price.');
}
if ($size !== '' && !in_array($size, ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'], true)) {
    json_error('Pick a valid size.');
}
if (mb_strlen($color) > 40) {
    json_error('Color must be 40 characters or fewer.');
}
if (mb_strlen($fabric) > 60) {
    json_error('Fabric must be 60 characters or fewer.');
}
$sizeValue   = $size   !== '' ? $size   : null;
$colorValue  = $color  !== '' ? $color  : null;
$fabricValue = $fabric !== '' ? $fabric : null;

$storeId = null;
if ($storeIdRaw !== '') {
    if (!ctype_digit($storeIdRaw)) {
        json_error('Pick a valid thrift spot.');
    }
    $stmt = $pdo->prepare('SELECT id FROM stores WHERE id = ?');
    $stmt->execute([(int) $storeIdRaw]);
    if (!$stmt->fetch()) {
        json_error('That thrift spot no longer exists. Pick another one.');
    }
    $storeId = (int) $storeIdRaw;
}

// ---- Optional new photo ----
$uploadError = $_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE;
if ($uploadError !== UPLOAD_ERR_OK && $uploadError !== UPLOAD_ERR_NO_FILE) {
    $msg = in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
        ? 'Image must be under 5MB.'
        : 'The image could not be uploaded. Please try again.';
    json_error($msg);
}
$imagePath = $existing['image_path'];
$newFile = null;
if ($uploadError === UPLOAD_ERR_OK) {
    $allowedTypes = ['image/png' => 'png', 'image/jpeg' => 'jpg'];
    $mimeType = mime_content_type($_FILES['image']['tmp_name']);
    if (!isset($allowedTypes[$mimeType])) {
        json_error('Only PNG and JPG images are allowed.');
    }
    if ($_FILES['image']['size'] > 5 * 1024 * 1024) {
        json_error('Image must be under 5MB.');
    }
    $uploadDir = __DIR__ . '/../../uploads/hauls/';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
        error_log('hauls/update.php: cannot create ' . $uploadDir);
        json_error('Could not save the image.', 500);
    }
    $filename = 'haul_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $allowedTypes[$mimeType];
    if (!move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $filename)) {
        error_log('hauls/update.php: move_uploaded_file failed for ' . $uploadDir . $filename);
        json_error('Could not save the image.', 500);
    }
    $newFile = $uploadDir . $filename;
    $imagePath = 'uploads/hauls/' . $filename;
}

try {
    $stmt = $pdo->prepare(
        'UPDATE hauls SET store_id = ?, item_name = ?, price = ?, size = ?, color = ?, fabric = ?, image_path = ?
         WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([$storeId, $itemName, $price, $sizeValue, $colorValue, $fabricValue, $imagePath, $haulId, $userId]);
} catch (PDOException $e) {
    if ($newFile !== null) {
        @unlink($newFile);   // don't leave an orphan file behind
    }
    throw $e;
}

// Only now that the row points at the new photo is it safe to remove the old one
if ($newFile !== null && $existing['image_path'] && strpos($existing['image_path'], 'uploads/') === 0) {
    @unlink(__DIR__ . '/../../' . $existing['image_path']);
}

json_response(['haul_id' => $haulId]);