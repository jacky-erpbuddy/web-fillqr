<?php
require_once __DIR__ . '/../src/app.php';

session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

// Tenant inkl. Logo laden
$stmt = $pdo->prepare('SELECT name, logo_path FROM tbl_tenant WHERE id = ?');
$stmt->execute([$tenantId]);
$tenant = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['name' => 'Ihr Verein', 'logo_path' => null];
$tenantName = $tenant['name'] ?? 'Demo-Verein';
$tenantLogo = !empty($tenant['logo_path']) ? $tenant['logo_path'] : null;

$recaptchaSiteKey = app_getRecaptchaSiteKey();

// Formdaten/Fehlermeldungen aus Session holen
$formData   = $_SESSION['form_data']   ?? [];
$formErrors = $_SESSION['form_errors'] ?? [];

// Einmal benutzen, dann löschen
unset($_SESSION['form_data'], $_SESSION['form_errors']);

// Erlaubte Tage pro Monat (z.B. [1] oder [1,15])
$allowedDays = app_getAllowedEntryDays($pdo, $tenantId);

// Konkrete Eintrittstermine für die nächsten Monate erzeugen
$entryDateOptions = [];

$today = new DateTime('today');
// Wie weit in die Zukunft schauen? z.B. 6 Monate
$monthsToLookAhead = 6;

for ($i = 0; $i < $monthsToLookAhead; $i++) {
    // Ersten Tag des jeweiligen Monats holen
    $base = (clone $today)->modify('first day of +' . $i . ' month');

    foreach ($allowedDays as $day) {
        $d = clone $base;
        // Tag im aktuellen Monat setzen
        $d->setDate((int)$d->format('Y'), (int)$d->format('m'), $day);

        // Vergangene Termine überspringen
        if ($d < $today) {
            continue;
        }

        $value = $d->format('Y-m-d');   // für DB (ISO-Format)
        $label = $d->format('d.m.Y');   // für Anzeige im Formular

        $entryDateOptions[$value] = $label;
    }
}

// Sicherheitshalber nach Datum sortieren
ksort($entryDateOptions);

// Disziplinen / Sparten
$stmt = $pdo->prepare("
    SELECT code, label
    FROM tbl_discipline
    WHERE tenant_id = ? AND active = 1
    ORDER BY sort_no, label
");
$stmt->execute([$tenantId]);
$disciplines = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Mitgliedsarten
$types = app_getMembershipTypes($pdo, $tenantId);

// Seitentitel
$pageTitle = 'Aufnahmeantrag ' . $tenantName;
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= htmlspecialchars($pageTitle) ?></title>

  <link rel="stylesheet" href="/assets/css/base.css?v=1">

  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
</head>


<body>
  <div class="page">
    <div class="card">
      <div class="header-row">
        <div>
          <h1><?= htmlspecialchars($pageTitle) ?></h1>
          <p class="subtitle">
            Bitte füllen Sie den Antrag vollständig aus. Felder mit
            <span class="required">*</span> sind Pflichtfelder.
          </p>
        </div>
        <div class="logo-box">
          <div class="logo-placeholder">
            Hier könnte<br>Ihr Logo<br>stehen
          </div>

          <!-- Theme-Toggle -->
          <button type="button" id="theme-toggle" class="theme-toggle">
            🌙 Dunkel
          </button>
        </div>
      </div>


      <form action="/submit.php" method="post" enctype="multipart/form-data">
        <!-- =========================================
             Abschnitt 1: Angaben zur Person + Foto
        ========================================== -->
        <div class="form-section form-section--first">
          <div class="field">
            <span class="section-label">Angaben zur Person</span>
          </div>

          <div class="field field--inline">
            <div class="field__control">
              <label for="full_name">Vollständiger Name <span class="required">*</span></label>
              <input type="text" id="full_name" name="full_name" required
                     value="<?= htmlspecialchars($formData['full_name'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="birthdate">Geburtsdatum <span class="required">*</span></label>
              <input type="date" id="birthdate" name="birthdate" required
                     value="<?= htmlspecialchars($formData['birthdate'] ?? '') ?>">
            </div>
          </div>

          <div class="field">
            <label for="street">Straße und Hausnummer <span class="required">*</span></label>
            <input type="text" id="street" name="street" required
                   value="<?= htmlspecialchars($formData['street'] ?? '') ?>">
          </div>

          <div class="field field--inline">
            <div class="field__control" style="max-width: 140px;">
              <label for="zip">PLZ <span class="required">*</span></label>
              <input type="text" id="zip" name="zip" required
                     value="<?= htmlspecialchars($formData['zip'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="city">Ort <span class="required">*</span></label>
              <input type="text" id="city" name="city" required
                     value="<?= htmlspecialchars($formData['city'] ?? '') ?>">
            </div>
          </div>

          <div class="field field--inline">
            <div class="field__control">
              <label for="email">E-Mail <span class="required">*</span></label>
              <input type="email" id="email" name="email" required
                     value="<?= htmlspecialchars($formData['email'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="phone">Telefon <span class="required">*</span></label>
              <input type="text" id="phone" name="phone" required
                     value="<?= htmlspecialchars($formData['phone'] ?? '') ?>">
            </div>
          </div>

          <div class="field">
            <label for="photo">Foto (optional)</label>
            <input type="file" id="photo" name="photo" accept="image/jpeg,image/png,image/webp">
            <div class="help-text">
              Optionales Foto (JPG, PNG oder WEBP, max. 5&nbsp;MB).
            </div>
          </div>
        </div>

        <!-- =========================================
             Abschnitt 2: Gesetzlicher Vertreter
        ========================================== -->
        <div class="form-section">
          <div class="field">
            <span class="section-label">Gesetzlicher Vertreter (nur bei Minderjährigen)</span>
          </div>

          <div class="field">
            <label class="checkbox-row">
              <input type="checkbox" name="is_minor" value="1"
                     <?= !empty($formData['is_minor']) ? 'checked' : '' ?>>
              <span>Ich bin minderjährig. Die folgenden Felder werden von meinem gesetzlichen Vertreter ausgefüllt.</span>
            </label>
          </div>

          <div class="field field--inline">
            <div class="field__control">
              <label for="guardian_name">Name des gesetzlichen Vertreters</label>
              <input type="text" id="guardian_name" name="guardian_name"
                     value="<?= htmlspecialchars($formData['guardian_name'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="guardian_relation">Beziehung (z.&nbsp;B. Mutter, Vater)</label>
              <input type="text" id="guardian_relation" name="guardian_relation"
                     value="<?= htmlspecialchars($formData['guardian_relation'] ?? '') ?>">
            </div>
          </div>

          <div class="field field--inline">
            <div class="field__control">
              <label for="guardian_email">E-Mail des Vertreters</label>
              <input type="email" id="guardian_email" name="guardian_email"
                     value="<?= htmlspecialchars($formData['guardian_email'] ?? '') ?>">
            </div>
            <div class="field__control">
              <label for="guardian_phone">Telefon des Vertreters</label>
              <input type="text" id="guardian_phone" name="guardian_phone"
                     value="<?= htmlspecialchars($formData['guardian_phone'] ?? '') ?>">
            </div>
          </div>
        </div>

        <!-- =========================================
             Abschnitt 3: Mitgliedschaft & Eintritt
        ========================================== -->
        <div class="form-section">
          <div class="field">
            <span class="section-label">Mitgliedschaft &amp; Eintritt</span>
          </div>

          <div class="field">
            <label for="membership_type_code">Mitgliedschaft <span class="required">*</span></label>
            <select id="membership_type_code" name="membership_type_code" required>
              <?php foreach ($types as $t): ?>
                <?php $sel = (($formData['membership_type_code'] ?? '') === $t['code']) ? 'selected' : ''; ?>
                <option value="<?= htmlspecialchars($t['code']) ?>" <?= $sel ?>>
                  <?= htmlspecialchars($t['label']) ?>
                  <?php if ($t['price'] !== null): ?>
                    (<?= number_format($t['price'], 2, ',', '.') ?> €)
                  <?php endif; ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="field">
            <label for="style">Disziplin / Sparte</label>
            <select id="style" name="style">
              <option value="">Bitte auswählen</option>
              <?php foreach ($disciplines as $d): ?>
                <?php $sel = (($formData['style'] ?? '') === $d['code']) ? 'selected' : ''; ?>
                <option value="<?= htmlspecialchars($d['code']) ?>" <?= $sel ?>>
                  <?= htmlspecialchars($d['label']) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="field">
            <label for="entry_date">Gewünschter Eintrittstermin <span class="required">*</span></label>
            <select id="entry_date" name="entry_date" required>
              <option value="">Bitte auswählen</option>
              <?php foreach ($entryDateOptions as $value => $label): ?>
                <?php $sel = (($formData['entry_date'] ?? '') === $value) ? 'selected' : ''; ?>
                <option value="<?= htmlspecialchars($value) ?>" <?= $sel ?>>
                  <?= htmlspecialchars($label) ?>
                </option>
              <?php endforeach; ?>
            </select>
            <div class="help-text">
              Eintritt ist nur zu den oben aufgeführten Terminen möglich.
            </div>
          </div>

          <div class="field">
            <label for="remarks">Bemerkungen</label>
            <textarea id="remarks" name="remarks" rows="3"><?= htmlspecialchars($formData['remarks'] ?? '') ?></textarea>
          </div>
        </div>

        <!-- =========================================
             Abschnitt 4: SEPA-Lastschrift
        ========================================== -->
        <div class="form-section">
          <div class="field">
            <span class="section-label">SEPA-Lastschriftmandat</span>
          </div>

          <div class="field">
            <label for="sepa_account_holder">Kontoinhaber</label>
            <input type="text" id="sepa_account_holder" name="sepa_account_holder"
                   value="<?= htmlspecialchars($formData['sepa_account_holder'] ?? '') ?>">
          </div>

          <div class="field field--inline">
            <div class="field__control">
              <label for="sepa_iban">IBAN</label>
              <input type="text" id="sepa_iban" name="sepa_iban"
                     value="<?= htmlspecialchars($formData['sepa_iban'] ?? '') ?>">
            </div>
            <div class="field__control" style="max-width: 200px;">
              <label for="sepa_bic">BIC</label>
              <input type="text" id="sepa_bic" name="sepa_bic"
                     value="<?= htmlspecialchars($formData['sepa_bic'] ?? '') ?>">
            </div>
          </div>

          <div class="field">
            <label class="checkbox-row">
              <input type="checkbox" name="sepa_ok" value="1"
                     <?= !empty($formData['sepa_ok']) ? 'checked' : '' ?>>
              <span>Ich erteile dem Verein das SEPA-Lastschriftmandat für die fälligen Beiträge.</span>
            </label>
          </div>
        </div>

        <!-- =========================================
             Abschnitt 5: Rechtliches, Spam-Schutz, Errors, Submit
        ========================================== -->
        <div class="form-section">
          <div class="field">
            <span class="section-label">Rechtliche Hinweise</span>
          </div>

          <div class="field">
            <p class="help-text">
              Mit dem Absenden dieses Antrags beantrage ich die Aufnahme in den Verein
              <strong><?= htmlspecialchars($tenantName) ?></strong>.
            </p>
            <p class="help-text">
              Die Satzung und die Beitragsordnung des Vereins sind mir bekannt
              bzw. wurden mir zugänglich gemacht. Änderungen der Beitragsordnung
              werden durch den Verein rechtzeitig bekannt gegeben.
            </p>
            <p class="help-text">
              Hinweis zur Kündigung (Demo-Text): Die Kündigung der Mitgliedschaft ist
              zum Ende des laufenden Quartals möglich. Die Kündigung gilt als fristgerecht,
              wenn sie dem Verein spätestens 14 Tage vor Ablauf des jeweiligen Quartals vorliegt.
            </p>
          </div>

          <!-- Datenschutz -->
          <div class="field">
            <label class="checkbox-row">
              <input type="checkbox" name="privacy_ok" required
                     <?= !empty($formData['privacy_ok']) ? 'checked' : '' ?>>
              <span>Ich habe die Datenschutzerklärung gelesen und stimme zu.</span>
            </label>
          </div>

          <!-- reCAPTCHA Spam-Schutz -->
          <div class="field">
            <span class="section-label">Spam-Schutz</span>
            <div class="g-recaptcha"
                 data-sitekey="<?= htmlspecialchars($recaptchaSiteKey) ?>"></div>
            <div class="help-text">
              Bitte bestätigen Sie, dass Sie kein Roboter sind.
            </div>
          </div>

          <?php
            $hasServerErrors = !empty($formErrors);
            $errorBoxStyle   = $hasServerErrors ? '' : 'display:none;';
          ?>
          <div id="form-errors" class="error-box" style="<?= $errorBoxStyle ?>">
            <strong>Bitte prüfen Sie Ihre Eingaben:</strong>
            <ul>
              <?php if ($hasServerErrors): ?>
                <?php foreach ($formErrors as $msg): ?>
                  <li><?= htmlspecialchars($msg) ?></li>
                <?php endforeach; ?>
              <?php endif; ?>
            </ul>
          </div>

          <!-- Submit -->
          <div class="actions">
            <button type="submit" class="btn-primary">
              <span class="icon">✋</span>
              <span>Jetzt Antrag senden</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      
      // --------------------------
      // Theme-Toggle (Light/Dark)
      // --------------------------
      var body = document.body;
      var toggle = document.getElementById('theme-toggle');
      var storageKey = 'fillqr-theme';

      function applyTheme(theme) {
        if (theme === 'dark') {
          body.classList.add('theme-dark');
          if (toggle) toggle.textContent = '☀ Hell';
        } else {
          body.classList.remove('theme-dark');
          if (toggle) toggle.textContent = '🌙 Dunkel';
        }
      }

      // 1) Aus localStorage lesen (falls vorhanden)
      var stored = null;
      try {
        stored = window.localStorage.getItem(storageKey);
      } catch (e) {}

      if (stored === 'dark' || stored === 'light') {
        applyTheme(stored);
      } else {
        // Optional: System-Preference als Default
        var prefersDark = window.matchMedia &&
                          window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
      }

      // 2) Klick-Handler
      if (toggle) {
        toggle.addEventListener('click', function () {
          var isDark = body.classList.contains('theme-dark');
          var next = isDark ? 'light' : 'dark';
          applyTheme(next);
          try {
            window.localStorage.setItem(storageKey, next);
          } catch (e) {}
        });
      }
      
      
      var form = document.querySelector('form');
      var errorBox = document.getElementById('form-errors');
      if (!form || !errorBox) return;

      form.addEventListener('submit', function (e) {
        var errors = [];

        // Felder einsammeln
        var fullName   = form.querySelector('[name="full_name"]')?.value.trim() || '';
        var email      = form.querySelector('[name="email"]')?.value.trim() || '';
        var membership = form.querySelector('[name="membership_type_code"]')?.value.trim() || '';
        var entryDate  = form.querySelector('[name="entry_date"]')?.value.trim() || '';
        var birthdate  = form.querySelector('[name="birthdate"]')?.value.trim() || '';

        var street    = form.querySelector('[name="street"]')?.value.trim() || '';
        var zip       = form.querySelector('[name="zip"]')?.value.trim() || '';
        var city      = form.querySelector('[name="city"]')?.value.trim() || '';
        var phone     = form.querySelector('[name="phone"]')?.value.trim() || '';

        var isMinor    = form.querySelector('[name="is_minor"]')?.checked || false;
        var guardianName  = form.querySelector('[name="guardian_name"]')?.value.trim() || '';
        var guardianEmail = form.querySelector('[name="guardian_email"]')?.value.trim() || '';

        var sepaAccountHolder = form.querySelector('[name="sepa_account_holder"]')?.value.trim() || '';
        var sepaIban          = form.querySelector('[name="sepa_iban"]')?.value.trim() || '';
        var sepaOk            = form.querySelector('[name="sepa_ok"]')?.checked || false;

        var privacyOk         = form.querySelector('[name="privacy_ok"]')?.checked || false;

        // reCAPTCHA-Status holen (falls Script geladen)
        var recaptchaOk = true;
        if (typeof grecaptcha !== 'undefined') {
          recaptchaOk = grecaptcha.getResponse().length > 0;
        }

        // Basis-Pflichtfelder
        if (!fullName) {
          errors.push('Bitte geben Sie Ihren vollständigen Namen an.');
        }
        if (!birthdate) {
          errors.push('Bitte geben Sie Ihr Geburtsdatum an.');
        }
        if (!street) {
          errors.push('Bitte geben Sie Ihre Straße und Hausnummer an.');
        }
        if (!zip) {
          errors.push('Bitte geben Sie Ihre Postleitzahl an.');
        }
        if (!city) {
          errors.push('Bitte geben Sie Ihren Wohnort an.');
        }
        if (!phone) {
          errors.push('Bitte geben Sie eine Telefonnummer an.');
        }

        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          errors.push('Bitte geben Sie eine gültige E-Mail-Adresse an.');
        }
        if (!membership) {
          errors.push('Bitte wählen Sie eine Mitgliedschaft.');
        }
        if (!entryDate) {
          errors.push('Bitte wählen Sie einen Eintrittstermin.');
        }
        if (!privacyOk) {
          errors.push('Bitte stimmen Sie der Datenschutzerklärung zu.');
        }

        if (!recaptchaOk) {
          errors.push('Bitte bestätigen Sie, dass Sie kein Roboter sind.');
        }

        // Alter grob berechnen
        var age = null;
        if (birthdate) {
          var d = new Date(birthdate);
          if (!isNaN(d.getTime())) {
            var today = new Date();
            var a = today.getFullYear() - d.getFullYear();
            var m = today.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
              a--;
            }
            age = a;
          }
        }

        // Minderjährige-Regeln
        if (age !== null && age < 18) {
          if (!isMinor) {
            errors.push('Bei minderjährigen Mitgliedern muss das Feld „Ich bin minderjährig“ markiert sein.');
          }
          if (!guardianName) {
            errors.push('Bei minderjährigen Mitgliedern muss ein gesetzlicher Vertreter eingetragen werden.');
          }
        }
        if (isMinor && !guardianName) {
          errors.push('Bitte tragen Sie den Namen des gesetzlichen Vertreters ein.');
        }
        if (guardianEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardianEmail)) {
          errors.push('Die E-Mail-Adresse des gesetzlichen Vertreters ist nicht gültig.');
        }

        // SEPA-Regeln (Client-Seite, grob)
        if (sepaIban && !sepaOk) {
          errors.push('Wenn eine IBAN eingetragen ist, muss das SEPA-Lastschriftmandat bestätigt werden.');
        }
        if (sepaOk && !sepaIban) {
          errors.push('Wenn ein SEPA-Mandat erteilt wird, muss eine IBAN eingetragen werden.');
        }
        if (sepaOk && !sepaAccountHolder) {
          errors.push('Wenn ein SEPA-Mandat erteilt wird, muss der Kontoinhaber eingetragen werden.');
        }

        if (errors.length > 0) {
          e.preventDefault(); // Abschicken blocken

          var ul = errorBox.querySelector('ul');
          ul.innerHTML = '';
          errors.forEach(function (msg) {
            var li = document.createElement('li');
            li.textContent = msg;
            ul.appendChild(li);
          });

          errorBox.style.display = 'block';
          errorBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Box ausblenden, wenn alles OK
          errorBox.style.display = 'none';
        }
      });
    });


  </script>
</body>
</html>
