<?php
// Field mode's only write path to the server (see the app's own
// CONFIG.FIELD_MODE / saveStateToServer in index.html). Deliberately
// dumb: it just writes whatever bytes/JSON it's given, under a slug it
// validates against walks.json — all the actual logic (crop math, EXIF
// GPS, thumbnail generation, deciding what changed) stays client-side,
// same as the desktop maker's local-folder/zip save paths. Gated by one
// shared-secret token (see config.php) embedded in the field device's
// bookmarked URL — adequate for "keep strangers from editing my walk,"
// not bank-grade, which is proportionate for a single-person creative
// tool with nothing sensitive in it.

header('Content-Type: application/json');

function fail($code, $message) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'POST only');
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    fail(500, 'Not configured (missing config.php)');
}
require $configPath;

$key = $_POST['key'] ?? '';
if (!is_string($key) || !hash_equals(FIELD_MODE_TOKEN, $key)) {
    fail(403, 'Bad key');
}

$slug = $_POST['walk'] ?? '';
if (!is_string($slug) || !preg_match('/^[a-z0-9][a-z0-9-]*$/', $slug)) {
    fail(400, 'Bad walk slug');
}

$baseDir = dirname(__DIR__); // symmetrystroller/
$walkDir = $baseDir . '/walks/' . $slug;

$walkDataJson = $_POST['walkData'] ?? '';
$manifestJson = $_POST['manifest'] ?? '';
if (!is_string($walkDataJson) || !is_string($manifestJson)) {
    fail(400, 'Missing walkData/manifest');
}
$walkData = json_decode($walkDataJson, true);
$manifest = json_decode($manifestJson, true);
if ($walkData === null || !is_array($manifest)) {
    fail(400, 'walkData/manifest is not valid JSON');
}

// Every photo file's destination path, validated so a crafted request
// can't write outside walks/<slug>/photos/ (no traversal, no absolute
// paths, only the characters the client-side name-reservation logic
// itself ever produces).
$photoPaths = $_POST['photoPaths'] ?? [];
if (!is_array($photoPaths)) $photoPaths = [$photoPaths];
$photoFiles = $_FILES['photoFiles'] ?? null;

$pathPattern = '#^photos/(thumbs/)?[A-Za-z0-9._-]+$#';
foreach ($photoPaths as $p) {
    if (!is_string($p) || !preg_match($pathPattern, $p)) {
        fail(400, 'Bad photo path: ' . (is_string($p) ? $p : '(non-string)'));
    }
}
if ($photoFiles && count($photoPaths) !== count($photoFiles['tmp_name'])) {
    fail(400, 'photoPaths/photoFiles count mismatch');
}

// Everything validated — now actually write. mkdir with recursive=true
// is a no-op if the directory already exists (checked explicitly first
// since is_dir() is cheap and mkdir() on an existing dir would otherwise
// emit a warning).
function ensureDir($dir) {
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            fail(500, "Could not create directory: $dir");
        }
    }
}

ensureDir($walkDir);
ensureDir($walkDir . '/photos');
ensureDir($walkDir . '/photos/thumbs');

if ($photoFiles) {
    foreach ($photoPaths as $i => $relPath) {
        $tmpName = $photoFiles['tmp_name'][$i];
        $err = $photoFiles['error'][$i];
        if ($err !== UPLOAD_ERR_OK) {
            fail(400, "Upload error for $relPath: $err");
        }
        $dest = $walkDir . '/' . $relPath;
        if (!move_uploaded_file($tmpName, $dest)) {
            fail(500, "Could not write $relPath");
        }
        chmod($dest, 0644);
    }
}

$walkJsonPath = $walkDir . '/' . $slug . '.json';
if (file_put_contents($walkJsonPath, json_encode($walkData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
    fail(500, 'Could not write walk JSON');
}
chmod($walkJsonPath, 0644);

$manifestPath = $baseDir . '/walks.json';
if (file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
    fail(500, 'Could not write walks.json');
}
chmod($manifestPath, 0644);

echo json_encode(['success' => true]);
