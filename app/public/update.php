<?php
// /app/public/update.php — Self-Service: Mitgliederdaten aktualisieren (Magic Link)
require_once __DIR__ . '/../src/app.php';

session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);
$tenant   = app_getTenant($pdo);

$tenantName       = htmlspecialchars($tenant['name'] ?? 'Ihr Verein');
$recaptchaSiteKey = app_getRecaptchaSiteKey();
$host             = $_SERVER['HTTP_HOST'] ?? 'localhost';

// ─── Determine mode ────────────────────────────────────────────
$token       = trim($_GET['token'] ?? '');
$isPost      = ($_SERVER['REQUEST_METHOD'] === 'POST');
$message     = '';      // success / info message
$messageType = '';      // 'success' | 'error' | 'info'
$errors      = [];
$application = null;

// ================================================================
//  MODE A: Token in URL → show edit form or process update
// ================================================================
if ($token !== '') {

    // ── Validate token ──────────────────────────────────────────
    $stmt = $pdo->prepare("
        SELECT ml.*, a.tenant_id AS app_tenant_id
        FROM tbl_magic_link ml
        JOIN tbl_application a ON a.id = ml.application_id
        WHERE ml.token = ?
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $link = $stmt->fetch(PDO::FETCH_ASSOC);

    $tokenValid = $link
        && $link['app_tenant_id'] == $tenantId
        && $link['used_at'] === null
        && strtotime($link['expires_at']) > time();

    if (!$tokenValid) {
        $message     = 'Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.';
        $messageType = 'error';
        $token       = '';          // fall through to email form below
    } else {
        // Load application data
        $stmt = $pdo->prepare("
            SELECT id, full_name, birthdate, email, phone, street, zip, city, membership_type_code
            FROM tbl_application
            WHERE id = ? AND tenant_id = ?
            LIMIT 1
        ");
        $stmt->execute([$link['application_id'], $tenantId]);
        $application = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$application) {
            $message     = 'Der zugehörige Antrag wurde nicht gefunden.';
            $messageType = 'error';
            $token       = '';
        }
    }

    // ── Process update form POST ────────────────────────────────
    if ($token !== '' && $application && $isPost) {

        // CSRF check: token must match hidden field
        $csrfToken = trim($_POST['csrf_token'] ?? '');
        $csrfOk    = hash_equals($_SESSION['csrf_update'] ?? '', $csrfToken) && $csrfToken !== '';

        if (!$csrfOk) {
            $errors[] = 'Ungültige Sitzung. Bitte laden Sie die Seite neu.';
        }

        // Re-validate token (race condition / double-submit protection)
        $stmt = $pdo->prepare("
            SELECT id FROM tbl_magic_link
            WHERE token = ? AND used_at IS NULL AND expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute([$token]);
        if (!$stmt->fetch()) {
            $errors[] = 'Dieser Link ist bereits verwendet oder abgelaufen.';
        }

        // Collect & validate input
        $newStreet = trim($_POST['street'] ?? '');
        $newZip    = trim($_POST['zip']    ?? '');
        $newCity   = trim($_POST['city']   ?? '');
        $newPhone  = trim($_POST['phone']  ?? '');
        $newEmail  = trim($_POST['email']  ?? '');

        if ($newStreet === '') $errors[] = 'Bitte geben Sie Ihre Straße und Hausnummer an.';
        if ($newZip    === '') $errors[] = 'Bitte geben Sie Ihre Postleitzahl an.';
        if ($newCity   === '') $errors[] = 'Bitte geben Sie Ihren Wohnort an.';
        if ($newPhone  === '') $errors[] = 'Bitte geben Sie eine Telefonnummer an.';
        if ($newEmail  === '') {
            $errors[] = 'Bitte geben Sie eine E-Mail-Adresse an.';
        } elseif (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Bitte geben Sie eine gültige E-Mail-Adresse an.';
        }

        // ── No errors → persist ─────────────────────────────────
        if (empty($errors)) {
            // 1) Update application
            $stmt = $pdo->prepare("
                UPDATE tbl_application
                SET street = ?, zip = ?, city = ?, phone = ?, email = ?, updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ");
            $stmt->execute([$newStreet, $newZip, $newCity, $newPhone, $newEmail, $application['id'], $tenantId]);

            // 2) Mark token as used
            $stmt = $pdo->prepare("UPDATE tbl_magic_link SET used_at = NOW() WHERE token = ?");
            $stmt->execute([$token]);

            // 3) Log event
            $stmtEvent = $pdo->prepare("
                INSERT INTO tbl_application_event (application_id, ts, event, meta)
                VALUES (?, NOW(), 'self_service_update', ?)
            ");
            $meta = json_encode([
                'fields_updated' => ['street', 'zip', 'city', 'phone', 'email'],
                'ip'             => $_SERVER['REMOTE_ADDR'] ?? '',
            ], JSON_UNESCAPED_UNICODE);
            $stmtEvent->execute([$application['id'], $meta]);

            // 4) Notify admin
            $notifyTo = app_getNotifyEmail($pdo, $tenantId);
            if ($notifyTo) {
                $subject = "Daten aktualisiert (#{$application['id']}) – " . ($tenant['key_slug'] ?? $tenant['name']);
                $body  = "Hallo,\n\n";
                $body .= "ein Mitglied hat seine Kontaktdaten per Self-Service aktualisiert.\n";
                $body .= "Antrags-ID: #{$application['id']}\n";
                $body .= "Zeit: " . date('d.m.Y H:i') . "\n\n";
                $body .= "Admin-Ansicht: https://{$host}/admin/\n\n";
                $body .= "Hinweis: Diese E-Mail enthält bewusst keine persönlichen Daten.";
                $headers = "From: fillqr <no-reply@{$host}>\r\n";
                @mail($notifyTo, $subject, $body, $headers);
            }

            // 5) Show success
            $message     = 'Ihre Daten wurden aktualisiert. Sie können dieses Fenster schließen.';
            $messageType = 'success';
            $application = null; // hide the form
            $token       = '';   // prevent re-display
        } else {
            // Keep form data for re-display
            $application['street'] = $newStreet;
            $application['zip']    = $newZip;
            $application['city']   = $newCity;
            $application['phone']  = $newPhone;
            $application['email']  = $newEmail;
        }
    }
}

// ================================================================
//  MODE B: No token → email request form (POST processes it)
// ================================================================
if ($token === '' && $isPost && $messageType !== 'success') {

    // reCAPTCHA validation
    $recaptchaSecret = app_getRecaptchaSecret();
    $recaptchaToken  = $_POST['g-recaptcha-response'] ?? '';
    $recaptchaOk     = false;

    if ($recaptchaSecret && $recaptchaToken) {
        $postData = [
            'secret'   => $recaptchaSecret,
            'response' => $recaptchaToken,
            'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
        ];

        $json = false;
        if (function_exists('curl_init')) {
            $ch = curl_init('https://www.google.com/recaptcha/api/siteverify');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => http_build_query($postData),
                CURLOPT_TIMEOUT        => 5,
            ]);
            $json = curl_exec($ch);
            curl_close($ch);
        } else {
            $verifyUrl = 'https://www.google.com/recaptcha/api/siteverify?' . http_build_query($postData);
            $json = @file_get_contents($verifyUrl);
        }

        if ($json !== false) {
            $data = json_decode($json, true) ?: [];
            if (!empty($data['success'])) {
                $recaptchaOk = true;
            }
        } else {
            // Technical failure → accept (same pattern as submit.php)
            $recaptchaOk = true;
        }
    }

    // CSRF check
    $csrfToken = trim($_POST['csrf_token'] ?? '');
    $csrfOk    = hash_equals($_SESSION['csrf_email'] ?? '', $csrfToken) && $csrfToken !== '';

    if ($recaptchaOk && $csrfOk) {
        $requestEmail = trim($_POST['email'] ?? '');

        if ($requestEmail !== '' && filter_var($requestEmail, FILTER_VALIDATE_EMAIL)) {
            // Look up application by email + tenant
            $stmt = $pdo->prepare("
                SELECT id, full_name
                FROM tbl_application
                WHERE email = ? AND tenant_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            ");
            $stmt->execute([$requestEmail, $tenantId]);
            $app = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($app) {
                // Generate magic link token
                $magicToken = bin2hex(random_bytes(32));
                $stmt = $pdo->prepare("
                    INSERT INTO tbl_magic_link (token, application_id, tenant_id, created_at, expires_at)
                    VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))
                ");
                $stmt->execute([$magicToken, $app['id'], $tenantId]);

                // Send email
                $updateLink = "https://{$host}/update.php?token={$magicToken}";
                $tn = $tenant['name'] ?? 'Ihr Verein';

                $subject = "Ihre Daten aktualisieren – {$tn}";
                $body  = "Hallo,\n\n";
                $body .= "Sie haben eine Aktualisierung Ihrer Daten bei {$tn} angefordert.\n\n";
                $body .= "Klicken Sie auf den folgenden Link, um Ihre Daten zu bearbeiten:\n";
                $body .= "{$updateLink}\n\n";
                $body .= "Dieser Link ist 24 Stunden gültig und kann nur einmal verwendet werden.\n\n";
                $body .= "Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.\n\n";
                $body .= "Mit freundlichen Grüßen\n";
                $body .= $tn;

                $headers = "From: {$tn} <no-reply@{$host}>\r\n";
                @mail($requestEmail, $subject, $body, $headers);
            }
            // else: email not found → same message (no enumeration)
        }
    }

    // Always show same message — no email enumeration
    $message     = 'Falls ein Antrag mit dieser E-Mail-Adresse vorliegt, haben wir Ihnen einen Link zum Bearbeiten gesendet. Bitte prüfen Sie Ihr Postfach.';
    $messageType = 'info';
}

// ── Generate CSRF tokens for forms ──────────────────────────────
if ($token !== '' && $application) {
    $csrfUpdate = bin2hex(random_bytes(32));
    $_SESSION['csrf_update'] = $csrfUpdate;
} else {
    $csrfEmail = bin2hex(random_bytes(32));
    $_SESSION['csrf_email'] = $csrfEmail;
}

// ── Page title ──────────────────────────────────────────────────
$pageTitle = 'Daten aktualisieren – ' . ($tenant['name'] ?? 'Ihr Verein');
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= htmlspecialchars($pageTitle) ?></title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/assets/css/base.css?v=3">
<?php if ($token === '' && !$application): ?>
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
<?php endif; ?>
</head>

<body>
  <div class="page">
    <div class="card">

      <h1><?= htmlspecialchars($pageTitle) ?></h1>
      <p class="subtitle"><?= $tenantName ?></p>

<?php // ── Message display ─────────────────────────────────────── ?>
<?php if ($message !== ''): ?>
      <div class="msg-box msg-box--<?= $messageType ?>">
        <?= htmlspecialchars($message) ?>
      </div>
<?php endif; ?>

<?php // ── Error list ──────────────────────────────────────────── ?>
<?php if (!empty($errors)): ?>
      <div class="error-box">
        <strong>Bitte prüfen Sie Ihre Eingaben:</strong>
        <ul>
<?php   foreach ($errors as $e): ?>
          <li><?= htmlspecialchars($e) ?></li>
<?php   endforeach; ?>
        </ul>
      </div>
<?php endif; ?>

<?php // ════════════════════════════════════════════════════════════
      //  FORM A: Edit application data (token valid, application loaded)
      // ════════════════════════════════════════════════════════════ ?>
<?php if ($token !== '' && $application): ?>

      <form method="post" action="/update.php?token=<?= htmlspecialchars(urlencode($token)) ?>">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfUpdate) ?>">

        <!-- Read-only fields -->
        <div class="form-section form-section--first">
          <div class="field">
            <span class="section-label">Ihre Angaben</span>
          </div>

          <div class="field">
            <label>Name</label>
            <div class="field-readonly"><?= htmlspecialchars($application['full_name'] ?? '') ?></div>
          </div>

<?php if (!empty($application['birthdate'])): ?>
          <div class="field">
            <label>Geburtsdatum</label>
            <div class="field-readonly"><?= htmlspecialchars(date('d.m.Y', strtotime($application['birthdate']))) ?></div>
          </div>
<?php endif; ?>

<?php if (!empty($application['membership_type_code'])): ?>
          <div class="field">
            <label>Mitgliedschaft</label>
            <div class="field-readonly"><?= htmlspecialchars($application['membership_type_code']) ?></div>
          </div>
<?php endif; ?>
        </div>

        <!-- Editable fields -->
        <div class="form-section">
          <div class="field">
            <span class="section-label">Kontaktdaten bearbeiten</span>
          </div>

          <div class="field">
            <label for="street">Straße und Hausnummer <span class="required">*</span></label>
            <input type="text" id="street" name="street" required
                   value="<?= htmlspecialchars($application['street'] ?? '') ?>">
          </div>

          <div class="field field--inline">
            <div class="field__control" style="max-width: 140px;">
              <label for="zip">PLZ <span class="required">*</span></label>
              <input type="text" id="zip" name="zip" required
                     value="<?= htmlspecialchars($application['zip'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="city">Ort <span class="required">*</span></label>
              <input type="text" id="city" name="city" required
                     value="<?= htmlspecialchars($application['city'] ?? '') ?>">
            </div>
          </div>

          <div class="field field--inline">
            <div class="field__control">
              <label for="email">E-Mail <span class="required">*</span></label>
              <input type="email" id="email" name="email" required
                     value="<?= htmlspecialchars($application['email'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="phone">Telefon <span class="required">*</span></label>
              <input type="text" id="phone" name="phone" required
                     value="<?= htmlspecialchars($application['phone'] ?? '') ?>">
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="submit" class="btn-primary">
            Daten aktualisieren
          </button>
        </div>
      </form>

<?php // ════════════════════════════════════════════════════════════
      //  FORM B: Email request form (no token)
      // ════════════════════════════════════════════════════════════ ?>
<?php elseif ($messageType !== 'success'): ?>

      <form method="post" action="/update.php">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfEmail) ?>">

        <div class="form-section form-section--first">
          <div class="field">
            <label for="email">Geben Sie Ihre E-Mail-Adresse ein <span class="required">*</span></label>
            <input type="email" id="email" name="email" required
                   placeholder="ihre@email.de"
                   value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
            <div class="help-text">
              Wir senden Ihnen einen Link, mit dem Sie Ihre hinterlegten Daten bearbeiten können.
            </div>
          </div>

          <div class="field">
            <div class="g-recaptcha"
                 data-sitekey="<?= htmlspecialchars($recaptchaSiteKey) ?>"
                 data-theme="dark"></div>
          </div>
        </div>

        <div class="actions">
          <button type="submit" class="btn-primary">
            Link anfordern
          </button>
        </div>
      </form>

<?php endif; ?>

<?php if ($messageType === 'error' && $token === ''): ?>
      <div class="actions" style="margin-top: var(--spacing-sm);">
        <a href="/update.php" class="btn-link">Neuen Link anfordern</a>
      </div>
<?php endif; ?>

    </div>
  </div>
</body>
</html>
