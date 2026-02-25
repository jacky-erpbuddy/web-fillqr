<?php
/**
 * Migration 002: Status-ENUM erweitern fuer Mitgliederverwaltung.
 *
 * Fuegt neue Status-Werte hinzu:
 *   active, passive, resting, suspended, terminated, rejected
 *
 * Ausfuehren: php migrate_002_status_expand.php
 * (oder via Browser auf dem Server)
 */

require_once __DIR__ . '/../app/src/app.php';

$pdo = db();
$migrationName = 'migrate_002_status_expand';

// Pruefen ob bereits ausgefuehrt
$stmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_schema_version WHERE name = ?");
$stmt->execute([$migrationName]);
if ((int)$stmt->fetchColumn() > 0) {
    echo "Migration '$migrationName' wurde bereits ausgefuehrt.\n";
    exit(0);
}

echo "Starte Migration: $migrationName\n";

// ENUM erweitern
$sql = "ALTER TABLE tbl_application MODIFY COLUMN status
    ENUM('new','reviewed','active','passive','resting','suspended','terminated','rejected','exported','archived')
    NOT NULL DEFAULT 'new'";

try {
    $pdo->exec($sql);
    echo "OK: ENUM erweitert.\n";
} catch (PDOException $e) {
    echo "FEHLER: " . $e->getMessage() . "\n";
    exit(1);
}

// Migration als ausgefuehrt markieren
$stmt = $pdo->prepare("INSERT INTO tbl_schema_version (name) VALUES (?)");
$stmt->execute([$migrationName]);
echo "Migration '$migrationName' erfolgreich.\n";
