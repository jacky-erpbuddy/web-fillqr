<?php
require_once __DIR__ . '/../../src/app.php';

session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

// Tenant inkl. Logo laden
$stmt = $pdo->prepare('SELECT name, logo_path FROM tbl_tenant WHERE id = ?');
$stmt->execute([$tenantId]);
$tenant = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['name' => 'Ihr Verein', 'logo_path' => null];
$tenantName = $tenant['name'] ?? 'Demo-Verein';
$tenantLogo = !empty($tenant['logo_path']) ? $tenant['logo_path'] : null;



// CSRF-Token für Status-Formular vorbereiten
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// ID aus GET holen und validieren
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo "Ungültige Antrags-ID.";
    exit;
}

// Antrag für diesen Tenant laden
$stmt = $pdo->prepare("
    SELECT *
    FROM tbl_application
    WHERE tenant_id = :tenant_id
      AND id = :id
    LIMIT 1
");
$stmt->execute([
    ':tenant_id' => $tenantId,
    ':id'        => $id,
]);
$app = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$app) {
    http_response_code(404);
    echo "Antrag wurde nicht gefunden.";
    exit;
}

// Vereinsname (für Kopf)
$stmt = $pdo->prepare('SELECT name FROM tbl_tenant WHERE id = ?');
$stmt->execute([$tenantId]);
$tenantName = $stmt->fetchColumn() ?: 'Ihr Verein';

// Warnungen aus Event-Log nachladen (falls has_warnings = 1)
$warnings = [];
if (!empty($app['has_warnings'])) {
    $stmtW = $pdo->prepare("
        SELECT event
        FROM tbl_application_event
        WHERE application_id = :app_id
        ORDER BY ts DESC, id DESC
        LIMIT 5
    ");
    $stmtW->execute([':app_id' => $app['id']]);

    while ($rowW = $stmtW->fetch(PDO::FETCH_ASSOC)) {
        $data = json_decode($rowW['event'] ?? '', true);
        if (!is_array($data)) {
            continue;
        }
        if (!empty($data['warnings']) && is_array($data['warnings'])) {
            $warnings = $data['warnings'];
            break;
        }
    }
}

// Mapping Warn-Code → lesbarer Text
$warningMessages = [
    'birthdate_invalid'      => 'Geburtsdatum konnte nicht eindeutig ausgewertet werden – bitte prüfen.',
    'minor_flag_maybe_wrong' => 'Checkbox „Ich bin minderjährig“ ist gesetzt, das berechnete Alter liegt aber bei mindestens 18 Jahren.',
    'no_sepa_mandate'        => 'Es liegt kein SEPA-Lastschriftmandat vor – Beitragseinzug ggf. separat klären.',
];
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Antrag #<?= (int)$app['id'] ?> – <?= htmlspecialchars($tenantName) ?></title>

  <meta name="viewport" content="width=device-width,initial-scale=1">

  <!-- gemeinsame Basis-Styles -->
  <link rel="stylesheet" href="/assets/css/base.css?v=1">

  <!-- Detail-spezifische Styles -->
  <style>
    .page--admin {
      max-width: 900px;
      margin: 0 auto;
    }

    .card--admin {
      padding: 16px 18px 20px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 1.5rem;
    }

    .subtitle {
      margin: 0 0 16px;
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }

    .back-link {
      margin-bottom: 8px;
      font-size: 0.9rem;
    }

    /* Kopfzeile mit Status / Form */
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .04em;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      background: #fff;
    }

    .status-pill.status-new {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: #e7f1ff;
    }

    .status-pill.status-warn {
      border-color: #dc3545;
      color: #dc3545;
      background: #fde2e4;
    }

    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 0.7rem;
      border: 1px solid #ced4da;
      color: #495057;
      background: #fff;
      margin-left: 6px;
    }

    .status-form {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      font-size: 0.8rem;
    }

    .status-form label {
      color: var(--color-text-muted);
    }

    .status-form select {
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      font: inherit;
      background: #fff;
    }

    .status-form button {
      padding: 4px 10px;
      border-radius: 999px;
      border: none;
      background: var(--color-primary);
      color: #fff;
      font-size: 0.8rem;
      cursor: pointer;
    }

    .status-form button:hover {
      opacity: 0.9;
    }

    h2 {
      margin: 12px 0 6px;
      font-size: 1.0rem;
    }

    dl {
      margin: 0;
      display: grid;
      grid-template-columns: 160px 1fr;
      grid-row-gap: 4px;
      grid-column-gap: 10px;
      font-size: 0.9rem;
    }

    dt {
      font-weight: 600;
      color: var(--color-text-muted);
    }

    dd {
      margin: 0;
    }

    .muted {
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }

    .back-link a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .back-link a:hover {
      text-decoration: underline;
    }

    .warn-list {
      margin: 4px 0 0;
      padding-left: 18px;
      font-size: 0.85rem;
      color: #842029;
    }

    /* Mitgliedsfoto kompakt anzeigen */
    .member-photo {
      max-width: 240px;
      max-height: 240px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--color-border);
      background: #111827;
    }

    .member-photo img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover; /* Bild füllt den Rahmen, ohne verzerrt zu wirken */
    }


    /* Handy: Spalten im dl etwas schmaler */
    @media (max-width: 640px) {
      dl {
        grid-template-columns: 130px 1fr;
      }
    }

    /* ---------------------------------------
       Detailseite: Mobile-Ansicht
       --------------------------------------- */
    @media (max-width: 640px) {
      /* Status-Zeile untereinander statt nebeneinander */
      .status-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .status-form {
        width: 100%;
        justify-content: flex-start;
      }

      /* dl-Gitter auf eine Spalte herunterfahren */
      dl {
        grid-template-columns: 1fr;
      }

      dl dt {
        margin-top: 8px;
      }

      /* Foto auf kleinen Screens etwas flexibler */
      .member-photo {
        max-width: 260px;
        width: 100%;
      }
    }


  </style>
</head>

<body>
    <div class="page page--admin">

    <div class="header-row">
      <div>
        <div class="back-link">
          &larr; <a href="index.php">Zurück zur Übersicht</a>
        </div>

        <h1>
          Antrag #<?= (int)$app['id'] ?>
          – <?= htmlspecialchars($app['full_name'] ?? '') ?>
        </h1>
        <p class="subtitle">
          Verein: <strong><?= htmlspecialchars($tenantName) ?></strong><br>
          Eingegangen am <?= htmlspecialchars($app['created_at'] ?? '') ?>
          <?php if (!empty($app['updated_at'])): ?>
            · letzte Änderung <?= htmlspecialchars($app['updated_at']) ?>
          <?php endif; ?>
        </p>
      </div>

      <div class="header-right">
        <?php if (!empty($tenantLogo)): ?>
          <img src="<?= htmlspecialchars($tenantLogo) ?>"
               alt="Vereinslogo"
               style="display:block;max-width:130px;max-height:48px;border-radius:8px;">
        <?php else: ?>
          <div class="logo-placeholder">
            Hier könnte<br>Ihr Logo<br>stehen
          </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="card card--admin">

      <!-- Status-Block usw. wie gehabt -->

      <?php
        $pillClass = 'status-new';
        if (!empty($app['has_warnings'])) {
            $pillClass = 'status-warn';
        }
      ?>
      <div class="status-row">
        <p style="margin:0;">
          <span class="status-pill <?= $pillClass ?>">
            Status: <?= htmlspecialchars($app['status'] ?? '') ?>
            <?php if (!empty($app['has_warnings'])): ?>
              · ⚠ Hinweise
            <?php endif; ?>
          </span>
          <?php if (!empty($app['is_minor'])): ?>
            <span class="tag">Minderjährig</span>
          <?php endif; ?>
          <?php if (!empty($app['style'])): ?>
            <span class="tag">Sparte: <?= htmlspecialchars($app['style']) ?></span>
          <?php endif; ?>
          <?php if (!empty($app['membership_type_code'])): ?>
            <span class="tag">Tarif: <?= htmlspecialchars($app['membership_type_code']) ?></span>
          <?php endif; ?>
        </p>

        <form method="post" action="update_status.php" class="status-form">
          <input type="hidden" name="id" value="<?= (int)$app['id'] ?>">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
          <label for="status-select">Status ändern:</label>
          <select id="status-select" name="status">
            <option value="new"      <?= $app['status'] === 'new'      ? 'selected' : '' ?>>Neu</option>
            <option value="reviewed" <?= $app['status'] === 'reviewed' ? 'selected' : '' ?>>Geprüft</option>
            <option value="exported" <?= $app['status'] === 'exported' ? 'selected' : '' ?>>Exportiert</option>
            <option value="archived" <?= $app['status'] === 'archived' ? 'selected' : '' ?>>Archiviert</option>
          </select>
          <button type="submit">Speichern</button>
        </form>
      </div>

      <h2>Angaben zur Person</h2>
      <dl>
        <dt>Name</dt>
        <dd><?= htmlspecialchars($app['full_name'] ?? '') ?></dd>

        <dt>Geburtsdatum</dt>
        <dd><?= htmlspecialchars($app['birthdate'] ?? '–') ?></dd>

        <dt>Adresse</dt>
        <dd>
          <?php if (!empty($app['street'])): ?>
            <?= htmlspecialchars($app['street']) ?><br>
          <?php endif; ?>
          <?php if (!empty($app['zip']) || !empty($app['city'])): ?>
            <?= htmlspecialchars(trim(($app['zip'] ?? '') . ' ' . ($app['city'] ?? ''))) ?>
          <?php else: ?>
            <span class="muted">–</span>
          <?php endif; ?>
        </dd>

        <dt>E-Mail</dt>
        <dd>
          <?php if (!empty($app['email'])): ?>
            <a href="mailto:<?= htmlspecialchars($app['email']) ?>">
              <?= htmlspecialchars($app['email']) ?>
            </a>
          <?php else: ?>
            <span class="muted">–</span>
          <?php endif; ?>
        </dd>

        <dt>Telefon</dt>
        <dd><?= htmlspecialchars($app['phone'] ?? '') ?: '<span class="muted">–</span>' ?></dd>
      </dl>

      <h2>Gesetzlicher Vertreter</h2>
      <dl>
        <dt>Name</dt>
        <dd><?= htmlspecialchars($app['guardian_name'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>Beziehung</dt>
        <dd><?= htmlspecialchars($app['guardian_relation'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>E-Mail</dt>
        <dd>
          <?php if (!empty($app['guardian_email'])): ?>
            <a href="mailto:<?= htmlspecialchars($app['guardian_email']) ?>">
              <?= htmlspecialchars($app['guardian_email']) ?>
            </a>
          <?php else: ?>
            <span class="muted">–</span>
          <?php endif; ?>
        </dd>

        <dt>Telefon</dt>
        <dd><?= htmlspecialchars($app['guardian_phone'] ?? '') ?: '<span class="muted">–</span>' ?></dd>
      </dl>


      
      <h2>Mitgliedsfoto</h2>
      <dl>
        <dt>Foto</dt>
        <dd>
          <?php if (!empty($app['photo_path'])): ?>
            <div class="member-photo">
              <img
                src="<?= htmlspecialchars('/' . ltrim($app['photo_path'], '/')) ?>"
                alt="Mitgliedsfoto von <?= htmlspecialchars($app['full_name'] ?? '') ?>">
            </div>
          <?php else: ?>
            <span class="muted">Kein Foto hinterlegt.</span>
          <?php endif; ?>
        </dd>
      </dl>




      <h2>Mitgliedschaft & Eintritt</h2>
      <dl>
        <dt>Disziplin / Sparte</dt>
        <dd><?= htmlspecialchars($app['style'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>Mitgliedschaft</dt>
        <dd><?= htmlspecialchars($app['membership_type_code'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>Eintrittstermin</dt>
        <dd><?= htmlspecialchars($app['entry_date'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>Bemerkungen</dt>
        <dd><?= nl2br(htmlspecialchars($app['remarks'] ?? '')) ?: '<span class="muted">–</span>' ?></dd>
      </dl>

      <h2>SEPA-Lastschrift</h2>
      <dl>
        <dt>Kontoinhaber</dt>
        <dd><?= htmlspecialchars($app['sepa_account_holder'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>IBAN</dt>
        <dd><?= htmlspecialchars($app['sepa_iban'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>BIC</dt>
        <dd><?= htmlspecialchars($app['sepa_bic'] ?? '') ?: '<span class="muted">–</span>' ?></dd>

        <dt>Mandat erteilt</dt>
        <dd>
          <?php if (!empty($app['sepa_consent'])): ?>
            <?= htmlspecialchars($app['sepa_consent']) ?>
          <?php else: ?>
            <span class="muted">kein Mandat gespeichert</span>
          <?php endif; ?>
        </dd>
      </dl>

      <h2>System-Infos</h2>
      <dl>
        <dt>Interne ID</dt>
        <dd><?= (int)$app['id'] ?></dd>

        <dt>Tenant-ID</dt>
        <dd><?= (int)$app['tenant_id'] ?></dd>

        <dt>Warnungen</dt>
        <dd>
          <?php if (!empty($warnings)): ?>
            <ul class="warn-list">
              <?php foreach ($warnings as $code): ?>
                <?php $text = $warningMessages[$code] ?? ('Unbekannte Warnung: ' . $code); ?>
                <li><?= htmlspecialchars($text) ?></li>
              <?php endforeach; ?>
            </ul>
          <?php elseif (!empty($app['has_warnings'])): ?>
            <span class="muted">
              Es liegen Warnungen vor, konnten aber nicht aus dem Event-Log gelesen werden.
            </span>
          <?php else: ?>
            <span class="muted">Keine Warnungen markiert.</span>
          <?php endif; ?>
        </dd>
      </dl>
    </div>
  </div>
</body>
</html>
