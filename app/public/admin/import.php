<?php
// /admin/import.php – CSV-Import für Mitgliederdaten
require_once __DIR__ . '/../../src/app.php';
session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

require_once __DIR__ . '/auth.php';

// Tenant komplett laden (inkl. theme + settings)
$tenant     = app_getTenant($pdo);
$tenantName = $tenant['name'] ?? 'Demo-Verein';
$tenantLogo = !empty($tenant['logo_path']) ? $tenant['logo_path'] : null;
$theme      = $tenant['theme'] ?? [];

// CSRF-Token vorbereiten
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// ── IBAN-Validierung (Mod-97) ──────────────────────────────
function validateIBAN(string $iban): bool {
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

// Erwartete CSV-Spalten (festes Mapping)
$expectedColumns = [
    'Name', 'Email', 'Telefon', 'Geburtsdatum', 'Strasse',
    'PLZ', 'Ort', 'Mitgliedstyp', 'Abteilung', 'IBAN', 'BIC', 'Kontoinhaber'
];

// ── Zustand ermitteln ──────────────────────────────────────
$step       = 'upload';   // upload | preview | result
$errors     = [];
$preview    = [];
$imported   = 0;
$failed     = 0;
$failedRows = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // CSRF prüfen
    $token = $_POST['csrf_token'] ?? '';
    if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(400);
        echo 'Ungültige Anfrage (CSRF).';
        exit;
    }

    // ── Schritt 2: Import bestätigen ───────────────────────
    if (isset($_POST['confirm']) && $_POST['confirm'] === '1') {
        $step = 'result';
        $rows = $_SESSION['csv_import_rows'] ?? [];

        if (empty($rows)) {
            $errors[] = 'Keine Daten in der Session gefunden. Bitte erneut hochladen.';
        } else {
            $stmtInsert = $pdo->prepare("
                INSERT INTO tbl_application (
                    tenant_id, status, full_name, email, phone, birthdate,
                    street, zip, city, membership_type_code, style,
                    sepa_iban, sepa_bic, sepa_account_holder,
                    gdpr_consent, gdpr_consent_at, created_at
                ) VALUES (?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
            ");

            foreach ($rows as $i => $row) {
                $rowNum   = $i + 2; // +2: Header=1, 0-indexed
                $rowErrors = [];

                $name  = trim($row['Name'] ?? '');
                $email = trim($row['Email'] ?? '');

                // Pflichtfelder
                if ($name === '') {
                    $rowErrors[] = 'Name fehlt';
                }
                if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $rowErrors[] = 'E-Mail fehlt oder ungültig';
                }

                // IBAN prüfen (nur wenn angegeben)
                $iban = trim($row['IBAN'] ?? '');
                if ($iban !== '' && !validateIBAN($iban)) {
                    $rowErrors[] = 'IBAN ungültig';
                }

                if (!empty($rowErrors)) {
                    $failed++;
                    $failedRows[] = [
                        'row'    => $rowNum,
                        'name'   => $name,
                        'email'  => $email,
                        'reason' => implode('; ', $rowErrors),
                    ];
                    continue;
                }

                try {
                    $stmtInsert->execute([
                        $tenantId,
                        $name,
                        $email,
                        trim($row['Telefon'] ?? '') ?: null,
                        trim($row['Geburtsdatum'] ?? '') ?: null,
                        trim($row['Strasse'] ?? '') ?: null,
                        trim($row['PLZ'] ?? '') ?: null,
                        trim($row['Ort'] ?? '') ?: null,
                        trim($row['Mitgliedstyp'] ?? '') ?: null,
                        trim($row['Abteilung'] ?? '') ?: null,
                        $iban ?: null,
                        trim($row['BIC'] ?? '') ?: null,
                        trim($row['Kontoinhaber'] ?? '') ?: null,
                    ]);
                    $imported++;
                } catch (PDOException $e) {
                    $failed++;
                    $failedRows[] = [
                        'row'    => $rowNum,
                        'name'   => $name,
                        'email'  => $email,
                        'reason' => 'DB-Fehler: ' . $e->getMessage(),
                    ];
                }
            }

            // Session-Daten aufräumen
            unset($_SESSION['csv_import_rows']);
        }

    // ── Schritt 1: CSV hochladen + Vorschau ────────────────
    } else {
        $step = 'preview';

        // Datei-Upload prüfen
        if (empty($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'Datei konnte nicht hochgeladen werden.';
            $step = 'upload';
        } else {
            $file = $_FILES['csv_file'];

            // Dateigröße: max 2 MB
            if ($file['size'] > 2 * 1024 * 1024) {
                $errors[] = 'Datei ist zu groß (max. 2 MB).';
                $step = 'upload';
            }

            // Dateiendung prüfen
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext !== 'csv') {
                $errors[] = 'Nur CSV-Dateien (.csv) sind erlaubt.';
                $step = 'upload';
            }

            // MIME-Type prüfen (text/csv oder text/plain)
            if ($step === 'preview') {
                $mime = mime_content_type($file['tmp_name']);
                $allowedMimes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
                if (!in_array($mime, $allowedMimes, true)) {
                    $errors[] = 'Ungültiger Dateityp (' . htmlspecialchars($mime) . ').';
                    $step = 'upload';
                }
            }
        }

        if ($step === 'preview') {
            $handle = fopen($file['tmp_name'], 'r');
            if (!$handle) {
                $errors[] = 'Datei konnte nicht gelesen werden.';
                $step = 'upload';
            } else {
                // BOM entfernen (UTF-8)
                $bom = fread($handle, 3);
                if ($bom !== "\xEF\xBB\xBF") {
                    rewind($handle);
                }

                // Header lesen
                $header = fgetcsv($handle, 0, ',');
                if (!$header) {
                    $errors[] = 'CSV-Header konnte nicht gelesen werden.';
                    $step = 'upload';
                } else {
                    // Header normalisieren (Whitespace entfernen)
                    $header = array_map('trim', $header);

                    // Spalten prüfen
                    $missing = array_diff($expectedColumns, $header);
                    if (!empty($missing)) {
                        $errors[] = 'Fehlende Spalten: ' . implode(', ', $missing)
                                  . '. Bitte die Vorlage verwenden.';
                        $step = 'upload';
                    }
                }
            }
        }

        if ($step === 'preview' && isset($handle)) {
            $rows    = [];
            $lineNum = 1;

            while (($line = fgetcsv($handle, 0, ',')) !== false) {
                $lineNum++;
                // Leere Zeilen überspringen
                if (count($line) === 1 && trim($line[0]) === '') {
                    continue;
                }

                // Spalten dem Header zuordnen
                $row = [];
                foreach ($expectedColumns as $idx => $col) {
                    $row[$col] = $line[$idx] ?? '';
                }
                $rows[] = $row;
            }
            fclose($handle);

            if (empty($rows)) {
                $errors[] = 'Die CSV-Datei enthält keine Datenzeilen.';
                $step = 'upload';
            } else {
                // In Session speichern für Bestätigung
                $_SESSION['csv_import_rows'] = $rows;

                // Vorschau: erste 5 Zeilen
                $preview = array_slice($rows, 0, 5);
            }
        }
    }
}
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>CSV-Import – <?= htmlspecialchars($tenantName) ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">

  <link rel="icon" type="image/png" href="/favicon.png">

  <!-- gemeinsame Basis-Styles -->
  <link rel="stylesheet" href="/assets/css/base.css?v=7">
  <?= app_getThemeStyleTag($theme) ?>
<?php if (!empty($theme['default_theme']) && $theme['default_theme'] === 'light'): ?>
  <script>try{if(!localStorage.getItem('fillqr-theme'))localStorage.setItem('fillqr-theme','light')}catch(e){}</script>
<?php endif; ?>

  <!-- Import-spezifische Styles -->
  <style>
    .page--admin {
      max-width: 1280px;
      margin: 0 auto;
    }

    .card--admin {
      padding: var(--spacing-md) var(--spacing-md) var(--spacing-lg);
    }

    .btn-small {
      padding: 6px 16px;
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: 600;
      border-radius: var(--radius-md);
      border: none;
      background: linear-gradient(135deg, var(--color-cyan) 0%, var(--color-green) 100%);
      color: var(--color-bg);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .btn-small:hover {
      box-shadow: 0 0 20px color-mix(in srgb, var(--color-cyan) 40%, transparent);
      transform: translateY(-1px);
    }

    .btn-secondary {
      padding: 6px 16px;
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: 600;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all var(--transition-normal);
      text-decoration: none;
      display: inline-block;
    }

    .btn-secondary:hover {
      border-color: var(--color-cyan);
      color: var(--color-cyan);
    }

    /* Upload-Bereich */
    .upload-area {
      margin: var(--spacing-md) 0;
    }

    .upload-area input[type="file"] {
      font: inherit;
      font-size: var(--font-size-sm);
      color: var(--color-text);
    }

    .upload-hint {
      margin-top: var(--spacing-xs);
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }

    /* Tabelle */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }

    thead {
      background: var(--color-bg-light);
    }

    th {
      padding: 8px 10px;
      border-bottom: 1px solid var(--color-border);
      text-align: left;
      vertical-align: top;
      color: var(--color-cyan);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--color-border);
      text-align: left;
      vertical-align: top;
      color: var(--color-text);
    }

    tbody tr:hover {
      background: color-mix(in srgb, var(--color-cyan) 5%, transparent);
    }

    /* Fehler/Erfolg */
    .alert {
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-sm);
      font-size: var(--font-size-sm);
    }

    .alert--error {
      background: rgba(220, 53, 69, 0.1);
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
    }

    .alert--success {
      background: color-mix(in srgb, var(--color-green) 10%, transparent);
      border: 1px solid var(--color-green);
      color: var(--color-green);
    }

    .alert--info {
      background: color-mix(in srgb, var(--color-cyan) 10%, transparent);
      border: 1px solid var(--color-cyan);
      color: var(--color-cyan);
    }

    /* Vorschau-Info */
    .preview-info {
      margin: var(--spacing-sm) 0;
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    .preview-actions {
      display: flex;
      gap: 10px;
      margin-top: var(--spacing-md);
      align-items: center;
    }

    /* Fehlgeschlagene Zeilen */
    .failed-row {
      color: #ff5555;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .page--admin {
        max-width: 100%;
      }

      .preview-actions {
        flex-direction: column;
        align-items: stretch;
      }
    }
  </style>
</head>

<body>
<script>(function(){var t;try{t=localStorage.getItem('fillqr-theme')}catch(e){}if(t==='light')document.body.classList.add('theme-light');})()</script>
  <div class="page page--admin">

    <nav class="admin-nav" style="display:flex;gap:16px;margin-bottom:var(--spacing-sm);font-size:0.85rem;">
      <a href="index.php" style="color:var(--color-text-muted);text-decoration:none;">Mitglieder</a>
      <a href="import.php" style="color:var(--color-cyan);font-weight:600;">CSV-Import</a>
    </nav>

    <div class="header-row">
      <div>
        <h1>CSV-Import</h1>
        <p class="subtitle">
          Verein: <strong><?= htmlspecialchars($tenantName) ?></strong> –
          Mitgliederdaten per CSV-Datei importieren.
        </p>
      </div>
      <div class="logo-box<?= ($theme['logo_variant'] ?? '') === 'dark' ? ' logo-on-dark' : '' ?>">
        <?php if ($tenantLogo): ?>
          <img src="<?= htmlspecialchars($tenantLogo) ?>" alt="<?= htmlspecialchars($tenantName) ?>" class="logo">
        <?php else: ?>
          <div class="logo-placeholder">
            Hier könnte<br>Ihr Logo<br>stehen
          </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="card card--admin">

      <?php // ── Fehler anzeigen ──────────────────────────── ?>
      <?php foreach ($errors as $err): ?>
        <div class="alert alert--error"><?= htmlspecialchars($err) ?></div>
      <?php endforeach; ?>

      <?php // ══════════════════════════════════════════════════ ?>
      <?php // ── SCHRITT 1: Upload-Formular ────────────────── ?>
      <?php // ══════════════════════════════════════════════════ ?>
      <?php if ($step === 'upload'): ?>

        <h2>CSV-Datei hochladen</h2>

        <p class="upload-hint">
          Erwartete Spalten: <strong>Name, Email, Telefon, Geburtsdatum, Strasse, PLZ, Ort, Mitgliedstyp, Abteilung, IBAN, BIC, Kontoinhaber</strong><br>
          Pflichtfelder: Name, Email. Max. 2 MB, nur .csv-Dateien.
        </p>

        <p style="margin-top:var(--spacing-xs);">
          <a href="template_mitglieder.csv" download class="btn-secondary">Vorlage herunterladen</a>
        </p>

        <form method="post" enctype="multipart/form-data" class="upload-area">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
          <input type="file" name="csv_file" accept=".csv" required>
          <div style="margin-top:var(--spacing-sm);">
            <button type="submit" class="btn-small">Hochladen &amp; Vorschau</button>
          </div>
        </form>

      <?php // ══════════════════════════════════════════════════ ?>
      <?php // ── SCHRITT 2: Vorschau ───────────────────────── ?>
      <?php // ══════════════════════════════════════════════════ ?>
      <?php elseif ($step === 'preview'): ?>

        <h2>Vorschau</h2>

        <?php $totalRows = count($_SESSION['csv_import_rows'] ?? []); ?>
        <div class="alert alert--info">
          <?= $totalRows ?> Zeile<?= $totalRows !== 1 ? 'n' : '' ?> erkannt.
          <?php if ($totalRows > 5): ?>
            Es werden die ersten 5 Zeilen als Vorschau angezeigt.
          <?php endif; ?>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <?php foreach ($expectedColumns as $col): ?>
                  <th><?= htmlspecialchars($col) ?></th>
                <?php endforeach; ?>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($preview as $idx => $row): ?>
                <tr>
                  <td><?= $idx + 1 ?></td>
                  <?php foreach ($expectedColumns as $col): ?>
                    <td><?= htmlspecialchars($row[$col] ?? '') ?></td>
                  <?php endforeach; ?>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <div class="preview-actions">
          <form method="post" style="display:inline;">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
            <input type="hidden" name="confirm" value="1">
            <button type="submit" class="btn-small">
              Alle <?= $totalRows ?> Zeile<?= $totalRows !== 1 ? 'n' : '' ?> importieren
            </button>
          </form>
          <a href="import.php" class="btn-secondary">Abbrechen</a>
        </div>

      <?php // ══════════════════════════════════════════════════ ?>
      <?php // ── SCHRITT 3: Ergebnis ──────────────────────── ?>
      <?php // ══════════════════════════════════════════════════ ?>
      <?php elseif ($step === 'result'): ?>

        <h2>Import abgeschlossen</h2>

        <?php if ($imported > 0): ?>
          <div class="alert alert--success">
            <?= $imported ?> Mitglied<?= $imported !== 1 ? 'er' : '' ?> erfolgreich importiert (Status: Geprüft).
          </div>
        <?php endif; ?>

        <?php if ($failed > 0): ?>
          <div class="alert alert--error">
            <?= $failed ?> Zeile<?= $failed !== 1 ? 'n' : '' ?> fehlgeschlagen.
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Zeile</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Fehler</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($failedRows as $fr): ?>
                  <tr class="failed-row">
                    <td><?= (int)$fr['row'] ?></td>
                    <td><?= htmlspecialchars($fr['name']) ?></td>
                    <td><?= htmlspecialchars($fr['email']) ?></td>
                    <td><?= htmlspecialchars($fr['reason']) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>

        <div class="preview-actions">
          <a href="import.php" class="btn-small" style="text-decoration:none;">Weiteren Import starten</a>
          <a href="index.php" class="btn-secondary">Zur Übersicht</a>
        </div>

      <?php endif; ?>

    </div>
  </div>

  <!-- Theme Toggle -->
  <button type="button" id="theme-toggle" class="theme-toggle theme-toggle-fixed" title="Hell / Dunkel">
    <span class="theme-toggle__track"><span class="theme-toggle__thumb"></span></span>
    <span class="theme-toggle__label"></span>
  </button>
  <script src="/assets/js/theme.js?v=7"></script>
</body>
</html>
