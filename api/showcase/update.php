<?php
/**
 * POST /api/showcase/update.php
 * multipart/form-data:
 *   listing_id, item_name, description?, selling_method, size?, color?, fabric?, store_id?,
 *   bid_start_price?, bid_increment?, lock_price?, grab_price?, mine_price?, image? (file)
 * Edits one of the logged-in user's own ACTIVE listings. Drafts are saved
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
    json_error('You must be logged in to edit a showcase item.', 401);
}
$userId = (int) $_SESSION['user_id'];

if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json_error('That upload is too large.', 413);
}

$listingId     = isset($_POST['listing_id']) ? (int) $_POST['listing_id'] : 0;
$itemName      = trim((string) ($_POST['item_name'] ?? ''));
$description   = trim((string) ($_POST['description'] ?? ''));
$sellingMethod = (string) ($_POST['selling_method'] ?? '');
$size          = trim((string) ($_POST['size'] ?? ''));
$color         = trim((string) ($_POST['color'] ?? ''));
$fabric        = trim((string) ($_POST['fabric'] ?? ''));
$storeIdRaw    = trim((string) ($_POST['store_id'] ?? ''));

$stmt = $pdo->prepare("SELECT id, image_path FROM showcase_listings WHERE id = ? AND user_id = ? AND status = 'active'");
$stmt->execute([$listingId, $userId]);
$existing = $stmt->fetch();
if (!$existing) {
    json_error('Listing not found.', 404);
}

if ($itemName === '') {
    json_error('Give your listing a name first.');
}
if (mb_strlen($itemName) > 150) {
    json_error('Item name must be 150 characters or fewer.');
}
if (mb_strlen($description) > 500) {
    json_error('Description must be 500 characters or fewer.');
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

if (!in_array($sellingMethod, ['bidding', 'lock', 'grab', 'mine'], true)) {
    json_error('Invalid selling method.');
}
$num = fn(string $key) => (isset($_POST[$key]) && $_POST[$key] !== '') ? (float) $_POST[$key] : null;
$bidStart     = $num('bid_start_price');
$bidIncrement = $num('bid_increment');
$lockPrice    = $num('lock_price');
$grabPrice    = $num('grab_price');
$minePrice    = $num('mine_price');
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
foreach ([$bidStart, $bidIncrement, $lockPrice, $grabPrice, $minePrice] as $p) {
    if ($p !== null && ($p < 0 || $p > 99999999)) {
        json_error('Enter a valid price.');
    }
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
    $uploadDir = __DIR__ . '/../../uploads/showcase/';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
        error_log('showcase/update.php: cannot create ' . $uploadDir);
        json_error('Could not save the image.', 500);
    }
    $filename = 'showcase_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $allowedTypes[$mimeType];
    if (!move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $filename)) {
        error_log('showcase/update.php: move_uploaded_file failed for ' . $uploadDir . $filename);
        json_error('Could not save the image.', 500);
    }
    $newFile = $uploadDir . $filename;
    $imagePath = 'uploads/showcase/' . $filename;
}

$descriptionValue = $description !== '' ? $description : null;

try {
    $stmt = $pdo->prepare('
        UPDATE showcase_listings
        SET store_id = ?, item_name = ?, description = ?, size = ?, color = ?, fabric = ?,
            image_path = ?, selling_method = ?,
            bid_start_price = ?, bid_increment = ?, lock_price = ?, grab_price = ?, mine_price = ?
        WHERE id = ? AND user_id = ?
    ');
    $stmt->execute([
        $storeId, $itemName, $descriptionValue, $sizeValue, $colorValue, $fabricValue,
        $imagePath, $sellingMethod,
        $bidStart, $bidIncrement, $lockPrice, $grabPrice, $minePrice,
        $listingId, $userId,
    ]);
} catch (PDOException $e) {
    if ($newFile !== null) {
        @unlink($newFile);
    }
    throw $e;
}

if ($newFile !== null && $existing['image_path'] && strpos($existing['image_path'], 'uploads/') === 0) {
    @unlink(__DIR__ . '/../../' . $existing['image_path']);
}

json_response(['listing_id' => $listingId]);