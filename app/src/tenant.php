<?php
require_once __DIR__ . '/config.php';

function db(): PDO {
  static $pdo;
  if (!$pdo) {
    $pdo = new PDO(
      'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
      DB_USER, DB_PASS,
      [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
  }
  return $pdo;
}

/**
 * Ermittelt tenant_id anhand der aufgerufenen Hostname-Domain.
 * Nutzt deine Tabelle tbl_tenant_domain(host -> tenant_id, is_primary)
 */
function resolveTenantIdByHost(): ?int {
  $host = $_SERVER['HTTP_HOST'] ?? '';
  if ($host === '') return null;

  $sql = "SELECT tenant_id
          FROM tbl_tenant_domain
          WHERE host = :host
          LIMIT 1";
  $st = db()->prepare($sql);
  $st->execute([':host' => $host]);
  $id = $st->fetchColumn();
  return $id ? (int)$id : null;
}

/** Mitgliedstypen holen (nur aktive), sortiert */
function getMembershipTypes(int $tenantId): array {
  $sql = "SELECT id, code, label, price, sort_no
          FROM tbl_membership_type
          WHERE tenant_id = :tid AND active = 1
          ORDER BY sort_no, id";
  $st = db()->prepare($sql);
  $st->execute([':tid' => $tenantId]);
  return $st->fetchAll(PDO::FETCH_ASSOC);
}

if (!function_exists('resolveTenantId')) {
    /**
     * Ermittelt anhand der Domain (Host) den Tenant.
     * Nutzt tbl_tenant_domain (host -> tenant_id).
     */
    function resolveTenantId(PDO $pdo): int
    {
        $host = $_SERVER['HTTP_HOST'] ?? '';

        $stmt = $pdo->prepare('SELECT tenant_id FROM tbl_tenant_domain WHERE host = ?');
        $stmt->execute([$host]);
        $tenantId = $stmt->fetchColumn();

        if (!$tenantId) {
            // Wenn du aktuell nur einen Demo-Tenant hast, könntest du hier
            // auch vorübergehend einen Fallback einbauen:
            // return 1;
            throw new RuntimeException('Kein Tenant für Host: ' . $host);
        }

        return (int)$tenantId;
    }
}