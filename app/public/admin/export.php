<?php
// /admin/export.php – CSV-Export der Mitgliederdaten
require_once __DIR__ . '/../../src/app.php';
session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

require_once __DIR__ . '/auth.php';

$tenant     = app_getTenant($pdo);
$tenantName = $tenant['name'] ?? 'Verein';

// Filter aus GET (gleiche Logik wie index.php)
$statusMap    = app_getStatusMap();
$filterStatus = $_GET['status'] ?? '';
$filterStatus = array_key_exists($filterStatus, $statusMap) ? $filterStatus : '';
$dateFrom     = trim($_GET['date_from'] ?? '');
$dateTo       = trim($_GET['date_to'] ?? '');
$search       = trim($_GET['search'] ?? '');

$whereExtra = '';
$params     = [':tenant_id' => $tenantId];

if ($filterStatus !== '') {
    $whereExtra .= " AND status = :status";
    $params[':status'] = $filterStatus;
}
if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $whereExtra .= " AND created_at >= :date_from";
    $params[':date_from'] = $dateFrom . ' 00:00:00';
}
if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $dt = DateTime::createFromFormat('Y-m-d', $dateTo);
    if ($dt) {
        $dt->modify('+1 day');
        $whereExtra .= " AND created_at < :date_to";
        $params[':date_to'] = $dt->format('Y-m-d') . ' 00:00:00';
    }
}
if ($search !== '') {
    $whereExtra .= " AND (full_name LIKE :search OR email LIKE :search)";
    $params[':search'] = '%' . $search . '%';
}

// Daten laden
$sql = "
    SELECT id, created_at, status, full_name, email, phone, birthdate,
           street, zip, city, style, membership_type_code, entry_date,
           is_minor, guardian_name, guardian_relation, guardian_email, guardian_phone,
           sepa_account_holder, sepa_iban, sepa_bic, sepa_consent,
           gdpr_consent, gdpr_consent_at, remarks
    FROM tbl_application
    WHERE tenant_id = :tenant_id" . $whereExtra . "
    ORDER BY created_at DESC
";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Event-Log: Export dokumentieren (DSGVO-Audit)
$exportMeta = json_encode([
    'type'       => 'csv_export',
    'admin_id'   => $_SESSION['admin_user_id'] ?? null,
    'admin_email' => $_SESSION['admin_email'] ?? null,
    'filter'     => array_filter([
        'status' => $filterStatus,
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'search' => $search,
    ]),
    'row_count'  => count($rows),
    'ip'         => $_SERVER['REMOTE_ADDR'] ?? '',
], JSON_UNESCAPED_UNICODE);

// In tbl_application_event loggen (mit application_id=0 als System-Event)
// Fallback: Nur loggen wenn mindestens 1 Zeile exportiert wird
if (count($rows) > 0) {
    try {
        $stmtLog = $pdo->prepare("
            INSERT INTO tbl_application_event (application_id, ts, event, meta)
            VALUES (?, NOW(), 'csv_export', ?)
        ");
        $stmtLog->execute([$rows[0]['id'], $exportMeta]);
    } catch (PDOException $e) {
        // Export nicht blockieren wenn Logging fehlschlaegt
    }
}

// IBAN maskieren: nur letzte 4 Zeichen zeigen
function maskIban(?string $iban): string {
    if (!$iban || strlen($iban) < 5) return $iban ?? '';
    return str_repeat('*', strlen($iban) - 4) . substr($iban, -4);
}

// CSV-Header senden
$filename = 'mitglieder_' . preg_replace('/[^a-z0-9]/i', '_', $tenantName) . '_' . date('Y-m-d') . '.csv';
header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

// UTF-8 BOM fuer Excel
echo "\xEF\xBB\xBF";

$out = fopen('php://output', 'w');

// Header-Zeile
fputcsv($out, [
    'ID', 'Datum', 'Status', 'Name', 'E-Mail', 'Telefon', 'Geburtsdatum',
    'Strasse', 'PLZ', 'Ort', 'Disziplin', 'Mitgliedstyp', 'Eintrittsdatum',
    'Minderjaehrig', 'Vertreter Name', 'Vertreter Beziehung', 'Vertreter E-Mail', 'Vertreter Telefon',
    'SEPA Kontoinhaber', 'SEPA IBAN (maskiert)', 'SEPA BIC', 'SEPA Mandat erteilt',
    'DSGVO Einwilligung', 'DSGVO Datum', 'Bemerkungen',
]);

foreach ($rows as $row) {
    fputcsv($out, [
        $row['id'],
        $row['created_at'],
        app_getStatusLabel($row['status']),
        $row['full_name'],
        $row['email'],
        $row['phone'] ?? '',
        $row['birthdate'] ?? '',
        $row['street'] ?? '',
        $row['zip'] ?? '',
        $row['city'] ?? '',
        $row['style'] ?? '',
        $row['membership_type_code'] ?? '',
        $row['entry_date'] ?? '',
        $row['is_minor'] ? 'Ja' : 'Nein',
        $row['guardian_name'] ?? '',
        $row['guardian_relation'] ?? '',
        $row['guardian_email'] ?? '',
        $row['guardian_phone'] ?? '',
        $row['sepa_account_holder'] ?? '',
        maskIban($row['sepa_iban']),
        $row['sepa_bic'] ?? '',
        $row['sepa_consent'] ?? '',
        $row['gdpr_consent'] ? 'Ja' : 'Nein',
        $row['gdpr_consent_at'] ?? '',
        $row['remarks'] ?? '',
    ]);
}

fclose($out);
exit;
