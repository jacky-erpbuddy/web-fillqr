<?php
// update_status

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

// Eingaben einsammeln
$appId     = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$newStatus = $_POST['status']      ?? '';
$token     = $_POST['csrf_token']  ?? '';

// CSRF prüfen
if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
    http_response_code(400);
    echo 'Ungültige Anfrage (CSRF).';
    exit;
}

// ID prüfen
if ($appId <= 0) {
    http_response_code(400);
    echo 'Ungültige ID.';
    exit;
}

// Erlaubte Statuswerte
$allowedStatuses = ['new', 'reviewed', 'exported', 'archived'];
if (!in_array($newStatus, $allowedStatuses, true)) {
    http_response_code(400);
    echo 'Ungültiger Status.';
    exit;
}

// Aktuellen Status laden (inkl. Tenant-Prüfung)
$stmt = $pdo->prepare("
    SELECT status
    FROM tbl_application
    WHERE id = :id AND tenant_id = :tenant_id
");
$stmt->execute([
    ':id'        => $appId,
    ':tenant_id' => $tenantId,
]);
$oldStatus = $stmt->fetchColumn();

if ($oldStatus === false) {
    http_response_code(404);
    echo 'Antrag nicht gefunden.';
    exit;
}

// Nur schreiben, wenn sich wirklich etwas ändert
if ($oldStatus !== $newStatus) {
    // Status aktualisieren
    $stmt = $pdo->prepare("
        UPDATE tbl_application
        SET status = :status,
            updated_at = NOW()
        WHERE id = :id AND tenant_id = :tenant_id
    ");
    $stmt->execute([
        ':status'    => $newStatus,
        ':id'        => $appId,
        ':tenant_id' => $tenantId,
    ]);

    // --- Event-Log später wieder aktivieren ---
    // $stmtEvent = $pdo->prepare("
    //     INSERT INTO tbl_application_event (application_id, ts, event)
    //     VALUES (:app_id, NOW(), :event)
    // ");
    //
    // $payload = json_encode([
    //     'type'       => 'status_changed',
    //     'old_status' => $oldStatus,
    //     'new_status' => $newStatus,
    // ], JSON_UNESCAPED_UNICODE);
    //
    // $stmtEvent->execute([
    //     ':app_id' => $appId,
    //     ':event'  => $payload,
    // ]);
}

// Zurück auf die Detailseite
header('Location: detail.php?id=' . $appId);
exit;
