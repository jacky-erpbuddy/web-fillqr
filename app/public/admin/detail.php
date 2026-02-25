<?php
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

// ID aus GET holen und validieren
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    http_response_code(400);
    echo "Ungueltige Antrags-ID.";
    exit;
}

// Antrag fuer diesen Tenant laden
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

// Dropdown-Daten laden: Mitgliedsarten
$types = app_getMembershipTypes($pdo, $tenantId);

// Dropdown-Daten laden: Disziplinen/Sparten
$stmtD = $pdo->prepare("SELECT code, label FROM tbl_discipline WHERE tenant_id = ? AND active = 1 ORDER BY sort_no");
$stmtD->execute([$tenantId]);
$disciplines = $stmtD->fetchAll(PDO::FETCH_ASSOC);

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

// Mapping Warn-Code -> lesbarer Text
$warningMessages = [
    'birthdate_invalid'      => 'Geburtsdatum konnte nicht eindeutig ausgewertet werden - bitte pruefen.',
    'minor_flag_maybe_wrong' => 'Checkbox "Ich bin minderjaehrig" ist gesetzt, das berechnete Alter liegt aber bei mindestens 18 Jahren.',
    'no_sepa_mandate'        => 'Es liegt kein SEPA-Lastschriftmandat vor - Beitragseinzug ggf. separat klaeren.',
];

// Validierungsfehler aus Session holen (falls vorhanden)
$updateErrors = $_SESSION['update_errors'] ?? [];
unset($_SESSION['update_errors']);
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Mitglied #<?= (int)$app['id'] ?> – <?= htmlspecialchars($tenantName) ?></title>

  <meta name="viewport" content="width=device-width,initial-scale=1">

  <link rel="icon" type="image/png" href="/favicon.png">

  <!-- gemeinsame Basis-Styles -->
  <link rel="stylesheet" href="/assets/css/base.css?v=7">
  <?= app_getThemeStyleTag($theme) ?>
<?php if (!empty($theme['default_theme']) && $theme['default_theme'] === 'light'): ?>
  <script>try{if(!localStorage.getItem('fillqr-theme'))localStorage.setItem('fillqr-theme','light')}catch(e){}</script>
<?php endif; ?>

  <!-- Detail-spezifische Styles -->
  <style>
    .page--admin {
      max-width: 900px;
      margin: 0 auto;
    }

    .card--admin {
      padding: var(--spacing-md) var(--spacing-md) var(--spacing-lg);
    }

    /* Formular-Inputs (rely on base.css for bg/color/border) */
    .edit-form input[type="text"],
    .edit-form input[type="email"],
    .edit-form input[type="date"],
    .edit-form select,
    .edit-form textarea {
      padding: 6px 10px;
    }

    .edit-form textarea {
      min-height: 80px;
      resize: vertical;
    }

    /* Pflichtfeld-Stern */
    .required::after {
      content: ' *';
      color: #dc3545;
    }

    /* Status-Zeile */
    .status-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px var(--spacing-md);
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-sm);
    }

    /* Speichern-Button */
    .btn-save {
      display: inline-block;
      padding: 10px 28px;
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: 600;
      border-radius: var(--radius-md);
      border: none;
      background: linear-gradient(135deg, var(--color-cyan) 0%, var(--color-green) 100%);
      color: var(--color-bg);
      cursor: pointer;
      transition: all var(--transition-normal);
      margin-top: var(--spacing-md);
    }

    .btn-save:hover {
      box-shadow: 0 0 20px color-mix(in srgb, var(--color-cyan) 40%, transparent);
      transform: translateY(-1px);
    }

    /* Erfolgs- / Fehlermeldungen */
    .success-box {
      background: color-mix(in srgb, var(--color-green) 15%, transparent);
      border: 1px solid var(--color-green);
      border-radius: var(--radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      margin-bottom: var(--spacing-md);
      color: var(--color-green);
    }

    .error-box {
      background: rgba(220, 53, 69, 0.15);
      border: 1px solid #dc3545;
      border-radius: var(--radius-md);
      padding: var(--spacing-sm) var(--spacing-md);
      margin-bottom: var(--spacing-md);
      color: #dc3545;
    }

    .error-box ul {
      margin: 4px 0 0 16px;
      padding: 0;
    }

    /* Mobile Detail */
    @media (max-width: 640px) {
      .status-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      dl {
        grid-template-columns: 1fr;
      }

      dl dt {
        margin-top: var(--spacing-xs);
      }

      .member-photo {
        max-width: 260px;
        width: 100%;
      }
    }
  </style>
</head>

<body>
<script>(function(){var t;try{t=localStorage.getItem('fillqr-theme')}catch(e){}if(t==='light')document.body.classList.add('theme-light');})()</script>
    <div class="page page--admin">

    <div class="header-row">
      <div>
        <div class="back-link">
          &larr; <a href="index.php">Zur&uuml;ck zur &Uuml;bersicht</a>
        </div>

        <h1>
          Mitglied #<?= (int)$app['id'] ?>
          – <?= htmlspecialchars($app['full_name'] ?? '') ?>
        </h1>
        <p class="subtitle">
          Verein: <strong><?= htmlspecialchars($tenantName) ?></strong><br>
          Eingegangen am <?= !empty($app['created_at']) ? date('d.m.Y H:i', strtotime($app['created_at'])) : '' ?>
          <?php if (!empty($app['updated_at'])): ?>
            &middot; letzte &Auml;nderung <?= date('d.m.Y H:i', strtotime($app['updated_at'])) ?>
          <?php endif; ?>
        </p>
      </div>

      <div class="logo-box<?= ($theme['logo_variant'] ?? '') === 'dark' ? ' logo-on-dark' : '' ?>">
        <?php if (!empty($tenantLogo)): ?>
          <img src="<?= htmlspecialchars($tenantLogo) ?>" alt="<?= htmlspecialchars($tenantName) ?>" class="logo">
        <?php else: ?>
          <div class="logo-placeholder">
            Hier k&ouml;nnte<br>Ihr Logo<br>stehen
          </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="card card--admin">

      <?php if (isset($_GET['saved'])): ?>
        <div class="success-box">&Auml;nderungen wurden gespeichert.</div>
      <?php endif; ?>

      <?php if (!empty($updateErrors)): ?>
        <div class="error-box">
          <strong>Fehler beim Speichern:</strong>
          <ul>
            <?php foreach ($updateErrors as $err): ?>
              <li><?= htmlspecialchars($err) ?></li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endif; ?>

      <!-- Status-Anzeige (read-only Pill) -->
      <?php
        $appStatus = $app['status'] ?? 'new';
        $pillClass = !empty($app['has_warnings']) ? 'status-warn' : 'status-' . $appStatus;
      ?>
      <div class="status-row">
        <p style="margin:0;">
          <span class="status-pill <?= $pillClass ?>">
            Status: <?= htmlspecialchars(app_getStatusLabel($appStatus)) ?>
            <?php if (!empty($app['has_warnings'])): ?>
              &middot; Hinweise
            <?php endif; ?>
          </span>
          <?php if (!empty($app['is_minor'])): ?>
            <span class="tag">Minderj&auml;hrig</span>
          <?php endif; ?>
          <?php if (!empty($app['style'])): ?>
            <span class="tag">Sparte: <?= htmlspecialchars($app['style']) ?></span>
          <?php endif; ?>
          <?php if (!empty($app['membership_type_code'])): ?>
            <span class="tag">Tarif: <?= htmlspecialchars($app['membership_type_code']) ?></span>
          <?php endif; ?>
        </p>
      </div>

      <!-- Hauptformular -->
      <form method="post" action="update_application.php" class="edit-form">
        <input type="hidden" name="id" value="<?= (int)$app['id'] ?>">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

        <h2>Angaben zur Person</h2>
        <dl>
          <dt><label for="full_name" class="required">Name</label></dt>
          <dd>
            <input type="text" id="full_name" name="full_name"
                   value="<?= htmlspecialchars($app['full_name'] ?? '') ?>" required>
          </dd>

          <dt><label for="birthdate">Geburtsdatum</label></dt>
          <dd>
            <input type="date" id="birthdate" name="birthdate"
                   value="<?= htmlspecialchars($app['birthdate'] ?? '') ?>">
          </dd>

          <dt><label for="street">Stra&szlig;e</label></dt>
          <dd>
            <input type="text" id="street" name="street"
                   value="<?= htmlspecialchars($app['street'] ?? '') ?>">
          </dd>

          <dt><label for="zip">PLZ</label></dt>
          <dd>
            <input type="text" id="zip" name="zip"
                   value="<?= htmlspecialchars($app['zip'] ?? '') ?>">
          </dd>

          <dt><label for="city">Ort</label></dt>
          <dd>
            <input type="text" id="city" name="city"
                   value="<?= htmlspecialchars($app['city'] ?? '') ?>">
          </dd>

          <dt><label for="email" class="required">E-Mail</label></dt>
          <dd>
            <input type="email" id="email" name="email"
                   value="<?= htmlspecialchars($app['email'] ?? '') ?>" required>
          </dd>

          <dt><label for="phone">Telefon</label></dt>
          <dd>
            <input type="text" id="phone" name="phone"
                   value="<?= htmlspecialchars($app['phone'] ?? '') ?>">
          </dd>
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



        <h2>Mitgliedschaft &amp; Eintritt</h2>
        <dl>
          <dt><label for="style">Disziplin / Sparte</label></dt>
          <dd>
            <select id="style" name="style">
              <option value="">– bitte w&auml;hlen –</option>
              <?php foreach ($disciplines as $disc): ?>
                <option value="<?= htmlspecialchars($disc['code']) ?>"
                  <?= ($app['style'] ?? '') === $disc['code'] ? 'selected' : '' ?>>
                  <?= htmlspecialchars($disc['label']) ?>
                </option>
              <?php endforeach; ?>
              <?php
                // Falls aktueller Wert nicht in der Liste ist, trotzdem anzeigen
                $styleInList = false;
                foreach ($disciplines as $disc) {
                    if ($disc['code'] === ($app['style'] ?? '')) { $styleInList = true; break; }
                }
                if (!$styleInList && !empty($app['style'])):
              ?>
                <option value="<?= htmlspecialchars($app['style']) ?>" selected>
                  <?= htmlspecialchars($app['style']) ?> (nicht mehr aktiv)
                </option>
              <?php endif; ?>
            </select>
          </dd>

          <dt><label for="membership_type_code">Mitgliedschaft</label></dt>
          <dd>
            <select id="membership_type_code" name="membership_type_code">
              <option value="">– bitte w&auml;hlen –</option>
              <?php foreach ($types as $type): ?>
                <option value="<?= htmlspecialchars($type['code']) ?>"
                  <?= ($app['membership_type_code'] ?? '') === $type['code'] ? 'selected' : '' ?>>
                  <?= htmlspecialchars($type['label']) ?>
                  <?php if (!empty($type['price'])): ?>
                    (<?= htmlspecialchars($type['price']) ?>)
                  <?php endif; ?>
                </option>
              <?php endforeach; ?>
              <?php
                $mtInList = false;
                foreach ($types as $type) {
                    if ($type['code'] === ($app['membership_type_code'] ?? '')) { $mtInList = true; break; }
                }
                if (!$mtInList && !empty($app['membership_type_code'])):
              ?>
                <option value="<?= htmlspecialchars($app['membership_type_code']) ?>" selected>
                  <?= htmlspecialchars($app['membership_type_code']) ?> (nicht mehr aktiv)
                </option>
              <?php endif; ?>
            </select>
          </dd>

          <dt><label for="entry_date">Eintrittstermin</label></dt>
          <dd>
            <input type="date" id="entry_date" name="entry_date"
                   value="<?= htmlspecialchars($app['entry_date'] ?? '') ?>">
          </dd>

          <dt><label for="remarks">Bemerkungen</label></dt>
          <dd>
            <textarea id="remarks" name="remarks"><?= htmlspecialchars($app['remarks'] ?? '') ?></textarea>
          </dd>
        </dl>

        <h2>SEPA-Lastschrift</h2>
        <dl>
          <dt><label for="sepa_account_holder">Kontoinhaber</label></dt>
          <dd>
            <input type="text" id="sepa_account_holder" name="sepa_account_holder"
                   value="<?= htmlspecialchars($app['sepa_account_holder'] ?? '') ?>">
          </dd>

          <dt><label for="sepa_iban">IBAN</label></dt>
          <dd>
            <input type="text" id="sepa_iban" name="sepa_iban"
                   value="<?= htmlspecialchars($app['sepa_iban'] ?? '') ?>">
          </dd>

          <dt><label for="sepa_bic">BIC</label></dt>
          <dd>
            <input type="text" id="sepa_bic" name="sepa_bic"
                   value="<?= htmlspecialchars($app['sepa_bic'] ?? '') ?>">
          </dd>

          <dt>Mandat erteilt</dt>
          <dd>
            <?php if (!empty($app['sepa_consent'])): ?>
              <?= htmlspecialchars($app['sepa_consent']) ?>
            <?php else: ?>
              <span class="muted">kein Mandat gespeichert</span>
            <?php endif; ?>
          </dd>
        </dl>

        <h2>Status</h2>
        <dl>
          <dt><label for="status-select">Status</label></dt>
          <dd>
            <select id="status-select" name="status">
              <?php foreach (app_getStatusMap() as $val => $label): ?>
                <option value="<?= $val ?>" <?= ($app['status'] ?? '') === $val ? 'selected' : '' ?>><?= htmlspecialchars($label) ?></option>
              <?php endforeach; ?>
            </select>
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

        <button type="submit" class="btn-save">Speichern</button>
      </form>

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
