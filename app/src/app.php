<?php

// ---------------------------------------------------------
// Globale App-Konfiguration (MVP)
// ---------------------------------------------------------

// Config zuerst laden (enthält DB + reCAPTCHA + SMTP Credentials)
require_once __DIR__.'/config.php';
require_once __DIR__.'/tenant.php';
require_once __DIR__.'/mail.php';

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
        // entry_days: KEIN Default hier! Wird aus tbl_tenant.entry_days gelesen.
        // Sonst überschreibt array_merge den DB-Wert.
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


function app_sendNotify(string $to, int $appId, string $tenantKey, int $memberNo = 0): void {
  $displayNo = $memberNo > 0 ? $memberNo : $appId;
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $link = "https://{$host}/admin/detail.php?id={$appId}";
  $subject = "Neuer Mitgliedsantrag (#{$displayNo})";
  $time = date('d.m.Y H:i');
  $body = <<<HTML
<p>Hallo,</p>
<p>soeben ist ein neuer Mitgliedsantrag eingegangen.</p>
<p><strong>Mitglieds-Nr.:</strong> #{$displayNo}<br>
<strong>Zeitpunkt:</strong> {$time}</p>
<p><a href="{$link}" style="display:inline-block;padding:10px 20px;background:#2b7eb8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Antrag ansehen</a></p>
<p style="color:#888;font-size:0.85em;">Diese E-Mail enthaelt bewusst keine persoenlichen Daten.</p>
HTML;
  app_sendMail($to, $subject, $body);
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

/**
 * Generates a <style> tag with CSS custom property overrides from tenant theme.
 * Maps theme_json keys to CSS variables for tenant-specific branding.
 */
function app_getThemeStyleTag(array $theme): string {
    $mapping = [
        'accent'           => '--color-cyan',
        'accent_secondary' => '--color-green',
        'primary'          => '--color-primary',
    ];

    $vars = [];
    foreach ($mapping as $key => $cssVar) {
        if (!empty($theme[$key]) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $theme[$key])) {
            $vars[] = $cssVar . ':' . htmlspecialchars($theme[$key], ENT_QUOTES);
        }
    }

    if (empty($vars)) {
        return '';
    }

    $varStr = implode(';', $vars);
    return '<style>:root{' . $varStr . '}body.theme-light{' . $varStr . '}</style>';
}

/**
 * Zentrale Status-Map: interner Wert → deutscher Anzeigename.
 * Definiert alle erlaubten Status-Werte für tbl_application.
 */
function app_getStatusMap(): array {
    return [
        'new'      => 'Neu',
        'active'   => 'Aktiv',
        'passive'  => 'Passiv',
        'resting'  => 'Ruhend',
        'archived' => 'Archiviert',
    ];
}

/**
 * Alle DB-gültigen Status (inkl. Legacy) für Validierung.
 */
function app_getAllStatuses(): array {
    return [
        'new'        => 'Neu',
        'reviewed'   => 'Geprüft',
        'active'     => 'Aktiv',
        'passive'    => 'Passiv',
        'resting'    => 'Ruhend',
        'suspended'  => 'Gesperrt',
        'terminated' => 'Gekündigt',
        'rejected'   => 'Abgelehnt',
        'exported'   => 'Exportiert',
        'archived'   => 'Archiviert',
    ];
}

/**
 * Gibt das deutsche Label für einen Status-Wert zurück.
 */
function app_getStatusLabel(string $status): string {
    $map = app_getAllStatuses();
    return $map[$status] ?? $status;
}

/**
 * IBAN-Validierung per Mod-97 (ISO 13616).
 * Akzeptiert Eingabe mit/ohne Leerzeichen, wandelt in Großbuchstaben um.
 */
/**
 * Sendet Bestätigungs-E-Mail an den Antragsteller.
 * Enthält nur die Bestätigung, keine sensiblen Daten.
 */
function app_sendConfirmation(string $applicantEmail, string $applicantName, int $appId, string $tenantName, int $memberNo = 0): void {
    $displayNo = $memberNo > 0 ? $memberNo : $appId;
    $subject = "Ihr Mitgliedsantrag bei {$tenantName} (#{$displayNo})";
    $name = htmlspecialchars($applicantName, ENT_QUOTES, 'UTF-8');
    $tn   = htmlspecialchars($tenantName, ENT_QUOTES, 'UTF-8');
    $time = date('d.m.Y H:i');
    $body = <<<HTML
<p>Hallo {$name},</p>
<p>vielen Dank f&uuml;r Ihren Mitgliedsantrag bei <strong>{$tn}</strong>.</p>
<p>Ihr Antrag wurde erfolgreich eingereicht und wird nun gepr&uuml;ft.</p>
<table style="margin:12px 0;font-size:0.95em;">
  <tr><td style="padding:4px 12px 4px 0;color:#888;">Mitglieds-Nr.:</td><td><strong>#{$displayNo}</strong></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#888;">Eingegangen am:</td><td>{$time}</td></tr>
</table>
<p>Sie erhalten eine weitere Benachrichtigung, sobald Ihr Antrag bearbeitet wurde.</p>
<p>Bei Fragen wenden Sie sich bitte direkt an den Verein.</p>
<p>Mit freundlichen Gr&uuml;&szlig;en<br><strong>{$tn}</strong></p>
HTML;
    app_sendMail($applicantEmail, $subject, $body, $tenantName);
}

/**
 * Gibt die nächste freie Mitgliedsnummer für einen Tenant zurück.
 */
function app_getNextMemberNo(PDO $pdo, int $tenantId): int {
    $stmt = $pdo->prepare("SELECT COALESCE(MAX(member_no), 0) + 1 FROM tbl_application WHERE tenant_id = ?");
    $stmt->execute([$tenantId]);
    return (int)$stmt->fetchColumn();
}

function app_validateIBAN(string $iban): bool {
    $iban = strtoupper(str_replace(' ', '', $iban));
    if (strlen($iban) < 15 || strlen($iban) > 34) return false;
    $moved = substr($iban, 4) . substr($iban, 0, 4);
    $numeric = '';
    for ($i = 0; $i < strlen($moved); $i++) {
        $c = $moved[$i];
        $numeric .= ctype_alpha($c) ? (ord($c) - 55) : $c;
    }
    return bcmod($numeric, '97') === '1';
}

