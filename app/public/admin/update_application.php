<?php
// update_application.php — Mitgliedsdaten bearbeiten (alle Felder)

require_once __DIR__ . '/../../src/app.php';
session_start();

// Nur POST zulassen
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

require_once __DIR__ . '/auth.php';

// Eingaben einsammeln
$appId = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$token = $_POST['csrf_token'] ?? '';

// CSRF pruefen
if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
    http_response_code(400);
    echo 'Ungueltige Anfrage (CSRF).';
    exit;
}

// ID pruefen
if ($appId <= 0) {
    http_response_code(400);
    echo 'Ungueltige ID.';
    exit;
}

// Aktuellen Datensatz laden (inkl. Tenant-Pruefung)
$stmt = $pdo->prepare("SELECT * FROM tbl_application WHERE id = :id AND tenant_id = :tenant_id LIMIT 1");
$stmt->execute([':id' => $appId, ':tenant_id' => $tenantId]);
$current = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$current) {
    http_response_code(404);
    echo 'Antrag nicht gefunden.';
    exit;
}

// --- Eingaben trimmen / sanitizen ---
$input = [
    'full_name'            => trim($_POST['full_name'] ?? ''),
    'email'                => trim($_POST['email'] ?? ''),
    'phone'                => trim($_POST['phone'] ?? ''),
    'birthdate'            => trim($_POST['birthdate'] ?? ''),
    'street'               => trim($_POST['street'] ?? ''),
    'zip'                  => trim($_POST['zip'] ?? ''),
    'city'                 => trim($_POST['city'] ?? ''),
    'membership_type_code' => trim($_POST['membership_type_code'] ?? ''),
    'style'                => trim($_POST['style'] ?? ''),
    'entry_date'           => trim($_POST['entry_date'] ?? ''),
    'remarks'              => trim($_POST['remarks'] ?? ''),
    'sepa_iban'            => trim($_POST['sepa_iban'] ?? ''),
    'sepa_bic'             => trim($_POST['sepa_bic'] ?? ''),
    'sepa_account_holder'  => trim($_POST['sepa_account_holder'] ?? ''),
    'status'               => trim($_POST['status'] ?? ''),
];

// --- Validierung ---
$errors = [];

// full_name: pflicht
if ($input['full_name'] === '') {
    $errors[] = 'Name darf nicht leer sein.';
}

// email: pflicht + format
if ($input['email'] === '') {
    $errors[] = 'E-Mail darf nicht leer sein.';
} elseif (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'E-Mail-Adresse hat ein ungueltiges Format.';
}

// IBAN: nur pruefen wenn angegeben UND geaendert (bestehende IBANs nicht erneut validieren)
if ($input['sepa_iban'] !== '' && $input['sepa_iban'] !== ($current['sepa_iban'] ?? '') && !app_validateIBAN($input['sepa_iban'])) {
    $errors[] = 'IBAN ist ungueltig (Mod-97 Pruefung fehlgeschlagen).';
}

// Status: nur erlaubte Werte (aus zentraler Map)
$allowedStatuses = array_keys(app_getAllStatuses());
if ($input['status'] !== '' && !in_array($input['status'], $allowedStatuses, true)) {
    $errors[] = 'Ungueltiger Status.';
}

// Datumsfelder: leer erlaubt, sonst Format pruefen
if ($input['birthdate'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['birthdate'])) {
    $errors[] = 'Geburtsdatum hat ein ungueltiges Format.';
}
if ($input['entry_date'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['entry_date'])) {
    $errors[] = 'Eintrittstermin hat ein ungueltiges Format.';
}

// Bei Fehlern zurueck zur Detailseite
if (!empty($errors)) {
    $_SESSION['update_errors'] = $errors;
    header('Location: detail.php?id=' . $appId);
    exit;
}

// --- Aenderungen ermitteln ---
$editableFields = [
    'full_name', 'email', 'phone', 'birthdate',
    'street', 'zip', 'city',
    'membership_type_code', 'style', 'entry_date', 'remarks',
    'sepa_iban', 'sepa_bic', 'sepa_account_holder', 'status',
];

$changes  = [];
$setClauses = [];
$params     = [];

foreach ($editableFields as $field) {
    $newVal = $input[$field];
    $oldVal = $current[$field] ?? '';

    // Leere Strings und NULL gleich behandeln
    $oldNorm = ($oldVal === null || $oldVal === '') ? '' : (string)$oldVal;
    $newNorm = ($newVal === null || $newVal === '') ? '' : (string)$newVal;

    if ($oldNorm !== $newNorm) {
        $changes[$field] = ['old' => $oldVal, 'new' => $newVal === '' ? null : $newVal];
        $setClauses[]    = "$field = :$field";
        $params[":$field"] = $newVal === '' ? null : $newVal;
    }
}

// Nur schreiben, wenn sich etwas geaendert hat
if (!empty($changes)) {
    $setClauses[] = 'updated_at = NOW()';

    $sql = "UPDATE tbl_application SET " . implode(', ', $setClauses)
         . " WHERE id = :id AND tenant_id = :tenant_id";
    $params[':id']        = $appId;
    $params[':tenant_id'] = $tenantId;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // Event-Log: Aenderungen protokollieren
    $stmtEvent = $pdo->prepare("
        INSERT INTO tbl_application_event (application_id, ts, event, meta)
        VALUES (?, NOW(), 'field_updated', ?)
    ");
    $stmtEvent->execute([
        $appId,
        json_encode($changes, JSON_UNESCAPED_UNICODE),
    ]);
}

// Zurueck zur Detailseite
header('Location: detail.php?id=' . $appId . '&saved=1');
exit;
