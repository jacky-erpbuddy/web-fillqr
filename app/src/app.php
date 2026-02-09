<?php

// ---------------------------------------------------------
// Globale App-Konfiguration (MVP)
// ---------------------------------------------------------
const APP_RECAPTCHA_SITE_KEY = 'REMOVED_SITE_KEY';
const APP_RECAPTCHA_SECRET   = 'REMOVED_SECRET_KEY';

/**
 * Liefert den reCAPTCHA-Site-Key für das Formular.
 */
function app_getRecaptchaSiteKey(): string {
    return APP_RECAPTCHA_SITE_KEY;
}

/**
 * Liefert das reCAPTCHA-Secret für die Serverprüfung.
 */
function app_getRecaptchaSecret(): string {
    return APP_RECAPTCHA_SECRET;
}


require_once __DIR__.'/config.php';
require_once __DIR__.'/tenant.php';

/**
 * Liefert das komplette Tenant-Objekt für den aktuellen Host.
 * - nutzt resolveTenantIdByHost()
 * - decoded theme_json / settings_json
 * - legt sinnvolle Defaults fest
 * - cached das Ergebnis für den Request
 */
function app_getTenant(PDO $pdo): array {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    // Tenant-ID per Host ermitteln (tbl_tenant_domain)
    $tenantId = resolveTenantIdByHost($pdo);

    $stmt = $pdo->prepare("
        SELECT
            id,
            key_slug,
            name,
            logo_path,
            email_notify,
            active,
            theme_json,
            settings_json,
            entry_days,
            created_at,
            updated_at
        FROM tbl_tenant
        WHERE id = ?
        LIMIT 1
    ");
    $stmt->execute([$tenantId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        throw new RuntimeException('TENANT_NOT_FOUND');
    }

    // JSON-Felder dekodieren
    $theme    = json_decode($row['theme_json']    ?? '', true);
    $settings = json_decode($row['settings_json'] ?? '', true);

    if (!is_array($theme))    { $theme    = []; }
    if (!is_array($settings)) { $settings = []; }

    // Defaults (werden von DB-Werten überschrieben)
    $themeDefaults = [
        'primary'      => '#0d6efd',
        'accent'       => '#6610f2',
        'background'   => '#f4f6fb',
        'logo_variant' => 'light',
    ];

    $settingsDefaults = [
        'require_iban'   => false,
        'show_birthdate' => true,
        'app_type'       => 'club',   // später: "fair", "expo" etc.
        'entry_days'     => [1, 15],  // Fallback, falls nichts konfiguriert
    ];

    $row['theme']    = array_merge($themeDefaults, $theme);
    $row['settings'] = array_merge($settingsDefaults, $settings);

    unset($row['theme_json'], $row['settings_json']);

    $cached = $row;
    return $cached;
}



// vorher: function getMembershipTypes(PDO $pdo, int $tenantId): array {
function app_getMembershipTypes(PDO $pdo, int $tenantId): array {
  $stmt = $pdo->prepare("SELECT id, code, label, price, sort_no 
                         FROM tbl_membership_type 
                         WHERE tenant_id = ? AND active = 1 
                         ORDER BY sort_no, id");
  $stmt->execute([$tenantId]);
  return $stmt->fetchAll();
}

// Minimalvalidierung + Insert in tbl_application
function createApplication(PDO $pdo, int $tenantId, array $in): int {
  $full = trim($in['full_name'] ?? '');
  $email = trim($in['email'] ?? '');
  $mtCode = trim($in['membership_type_code'] ?? '');
  $privacy = isset($in['privacy_ok']) && $in['privacy_ok'] === '1';

  if ($full === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$privacy || $mtCode === '') {
    throw new RuntimeException('VALIDATION_ERROR');
  }

  $sql = "INSERT INTO tbl_application
          (tenant_id, created_at, status, full_name, email, membership_type_code, remarks)
          VALUES (?, NOW(), 'new', ?, ?, ?, ?)";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$tenantId, $full, $email, $mtCode, $in['remarks'] ?? null]);

  return (int)$pdo->lastInsertId();
}


function app_saveApplication(PDO $pdo, int $tenantId, array $d): int {
  $sql = "INSERT INTO tbl_application
            (tenant_id, full_name, email, phone, membership_type_code, remarks)
          VALUES
            (:tenant_id, :full_name, :email, :phone, :mt_code, :remarks)";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([
    ':tenant_id' => $tenantId,
    ':full_name' => trim($d['full_name'] ?? ''),
    ':email'     => trim($d['email'] ?? ''),
    ':phone'     => trim($d['phone'] ?? ''),
    ':mt_code'   => ($d['membership_type_code'] ?? null),
    ':remarks'   => trim($d['remarks'] ?? ''),
  ]);
  return (int)$pdo->lastInsertId();
}

function app_getNotifyEmail(PDO $pdo, int $tenantId): ?string {
    // Tenant über Host ermitteln (id-Parameter bleibt nur für Abwärtskompatibilität)
    $tenant = app_getTenant($pdo);

    $to = $tenant['email_notify'] ?? null;
    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    return $to;
}


function app_sendNotify(string $to, int $appId, string $tenantKey): void {
  // Kurze, PII-freie Mail
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $linkAdmin = "https://{$host}/admin/"; // PII-Ansicht nur im Admin
  $subject = "Neuer Mitgliedsantrag (#{$appId}) – {$tenantKey}";
  $body = "Hallo,\n\nsoeben ist ein neuer Antrag eingegangen.\n"
        . "Antrags-ID: #{$appId}\n"
        . "Zeit: " . date('d.m.Y H:i') . "\n\n"
        . "Admin-Ansicht: {$linkAdmin}\n\n"
        . "Hinweis: Diese E-Mail enthält bewusst keine persönlichen Daten.";
  $headers = "From: fillqr Demo <no-reply@{$host}>\r\n";
  // Provider nutzt i.d.R. sendmail -> mail() reicht für den Start.
  @mail($to, $subject, $body, $headers);
}

function app_getAllowedEntryDays(PDO $pdo, int $tenantId): array {
    // Tenant inkl. settings holen
    $tenant = app_getTenant($pdo);

    // Kleine Normalisierungsfunktion für "1,15" oder Arrays
    $normalizeDays = function ($value): array {
        if (is_array($value)) {
            $src = $value;
        } elseif (is_string($value) && $value !== '') {
            // Komma- oder Leerzeichen-getrennt zulassen
            $src = preg_split('/[,\s]+/', $value);
        } else {
            return [];
        }

        $days = [];
        foreach ($src as $p) {
            $n = (int)$p;
            if ($n >= 1 && $n <= 28 && !in_array($n, $days, true)) {
                $days[] = $n;
            }
        }
        sort($days);
        return $days;
    };

    // 1) bevorzugt aus settings.entry_days (JSON)
    $days = $normalizeDays($tenant['settings']['entry_days'] ?? null);

    // 2) Fallback: Spalte entry_days aus tbl_tenant (z.B. "1,15")
    if (!$days) {
        $days = $normalizeDays($tenant['entry_days'] ?? null);
    }

    // 3) Letzter Fallback
    if (!$days) {
        $days = [1];
    }

    return $days;
}


