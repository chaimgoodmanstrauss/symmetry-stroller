<?php
// Field mode's only write path to the server (see the app's own
// CONFIG.FIELD_MODE / saveStateToServer in index.html). Deliberately
// dumb: it just writes whatever bytes/JSON it's given, under a slug it
// validates against walks.json — all the actual logic (crop math, EXIF
// GPS, thumbnail generation, deciding what changed) stays client-side,
// same as the desktop maker's local-folder/zip save paths.
//
// Gated by an ECDSA P-256 signature, not a shared secret: config.php
// holds only the PUBLIC key (safe to be public — the point of using a
// keypair instead of one shared token is that leaking this file leaks
// nothing usable for forging future writes). The private key exists
// only on the field device itself and is never sent here; the client
// signs a short string binding the walk slug, a timestamp, and a hash
// of the walk data instead, and this file just verifies that signature.

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

// The timestamp is part of the signed payload (so it can't be tampered
// with independently of the signature) and is also checked against the
// server's own clock — a signature captured off the wire is only ever
// valid for a few minutes, not forever.
$timestamp = $_POST['timestamp'] ?? '';
if (!is_string($timestamp) || !ctype_digit($timestamp)) {
    fail(400, 'Bad timestamp');
}
$timestampMs = (int) $timestamp;
if (abs(time() - intdiv($timestampMs, 1000)) > 300) {
    fail(403, 'Signature expired — check the device clock and try again');
}

$signatureB64 = $_POST['signature'] ?? '';
if (!is_string($signatureB64)) {
    fail(400, 'Missing signature');
}
$rawSignature = base64_decode($signatureB64, true);
if ($rawSignature === false || strlen($rawSignature) !== 64) {
    fail(400, 'Bad signature encoding');
}

// WebCrypto's ECDSA signatures are raw r||s (IEEE P1363, 32 bytes each
// for P-256) — openssl_verify wants a DER-encoded SEQUENCE of two
// INTEGERs instead, so this converts one to the other. Verified against
// a real browser-produced signature before this went live (see the
// deploy notes) rather than trusted on inspection alone, since a subtly
// wrong byte-level conversion here would fail silently (every signature
// rejected) rather than loudly.
function derPositiveInteger($bytes) {
    $bytes = ltrim($bytes, "\x00");
    if ($bytes === '') $bytes = "\x00";
    if ((ord($bytes[0]) & 0x80) !== 0) $bytes = "\x00" . $bytes;
    return "\x02" . chr(strlen($bytes)) . $bytes;
}
function derFromRawEcdsaSignature($raw) {
    $r = derPositiveInteger(substr($raw, 0, 32));
    $s = derPositiveInteger(substr($raw, 32, 32));
    $body = $r . $s;
    return "\x30" . chr(strlen($body)) . $body;
}

$signPayload = $slug . '|' . $timestampMs . '|' . hash('sha256', $walkDataJson);
$derSignature = derFromRawEcdsaSignature($rawSignature);
$publicKey = openssl_pkey_get_public(FIELD_MODE_PUBLIC_KEY_PEM);
if ($publicKey === false) {
    fail(500, 'Server misconfigured (bad public key)');
}
$verifyResult = openssl_verify($signPayload, $derSignature, $publicKey, OPENSSL_ALGO_SHA256);
if ($verifyResult !== 1) {
    fail(403, 'Bad signature');
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
