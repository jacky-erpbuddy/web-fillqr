<?php
// /demo/public/submit.php
require_once __DIR__ . '/../src/app.php';

session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);


// --------------------------------------------
// reCAPTCHA-Validierung (serverseitig)
// --------------------------------------------
$recaptchaSecret = app_getRecaptchaSecret();
$recaptchaToken  = $_POST['g-recaptcha-response'] ?? '';

$recaptchaOk         = false;
$recaptchaErrorCodes = [];

// Nur prüfen, wenn Secret + Token vorhanden sind
if ($recaptchaSecret && $recaptchaToken) {

    $postData = [
        'secret'   => $recaptchaSecret,
        'response' => $recaptchaToken,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ];

    $json = false;

    // 1) Bevorzugt: cURL
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
        // 2) Fallback: file_get_contents (falls erlaubt)
        $verifyUrl = 'https://www.google.com/recaptcha/api/siteverify?'
            . http_build_query($postData);
        $json = @file_get_contents($verifyUrl);
    }

    if ($json !== false) {
        $data = json_decode($json, true) ?: [];

        if (!empty($data['success'])) {
            $recaptchaOk = true;
        } else {
            if (!empty($data['error-codes']) && is_array($data['error-codes'])) {
                $recaptchaErrorCodes = $data['error-codes'];
            }
        }
    } else {
        // Technischer Fehler (Server kommt nicht zu Google o.ä.)
        // → Wir lassen den Antrag NICHT scheitern, sondern akzeptieren ihn
        //   und verlassen uns in dem Fall nur auf die Client-Prüfung.
        $recaptchaOk = true;
    }
}

// Wenn Google explizit "nein" sagt → sauber abbrechen
if (!$recaptchaOk) {
    http_response_code(400);
    ?>
    <!doctype html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <title>Fehler beim Absenden</title>
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f4f6fb;
          margin: 0;
          padding: 24px 16px;
        }
        .page {
          max-width: 720px;
          margin: 0 auto;
        }
        .card {
          background: #fff;
          border-radius: 12px;
          padding: 24px 20px 28px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
          border: 1px solid #e2e6f0;
        }
        h1 {
          margin-top: 0;
          font-size: 1.4rem;
        }
        p { font-size: 0.95rem; }
        a.btn {
          display: inline-block;
          margin-top: 12px;
          padding: 8px 16px;
          border-radius: 999px;
          text-decoration: none;
          background: #0d6efd;
          color: #fff;
          font-weight: 600;
        }
        .techinfo {
          margin-top: 10px;
          font-size: 0.8rem;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="card">
          <h1>Ihr Antrag konnte nicht gesendet werden</h1>
          <p>
            Die reCAPTCHA-Prüfung ist fehlgeschlagen. Bitte gehen Sie einen Schritt
            zurück, aktualisieren Sie die Seite und versuchen Sie es erneut.
          </p>
          <p>
            Wenn das Problem weiterhin besteht, wenden Sie sich bitte direkt an den Verein.
          </p>
          <?php if (!empty($recaptchaErrorCodes)): ?>
            <p class="techinfo">
              Technische Info (für Administrator):
              <?= htmlspecialchars(implode(', ', $recaptchaErrorCodes)) ?>
            </p>
          <?php endif; ?>
          <a href="javascript:history.back()" class="btn">Zurück zum Formular</a>
        </div>
      </div>
    </body>
    </html>
    <?php
    exit;
}



// Nur POST-Zugriffe zulassen
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

/**
 * IBAN-Validierung nach klassischer Mod-97-Regel.
 */
function isValidIban(string $iban): bool {
    $iban = strtoupper(str_replace(' ', '', $iban));

    $len = strlen($iban);
    if ($len < 15 || $len > 34) {
        return false;
    }
    if (!preg_match('/^[A-Z0-9]+$/', $iban)) {
        return false;
    }

    // Erste 4 Zeichen nach hinten
    $rearranged = substr($iban, 4) . substr($iban, 0, 4);

    // Buchstaben → Zahlen
    $converted = '';
    for ($i = 0; $i < strlen($rearranged); $i++) {
        $ch = $rearranged[$i];
        if ($ch >= 'A' && $ch <= 'Z') {
            $converted .= (string)(ord($ch) - 55); // A=10, B=11, ...
        } else {
            $converted .= $ch;
        }
    }

    // Modulo 97 Schrittweise rechnen
    $remainder = 0;
    $lenConv   = strlen($converted);
    for ($i = 0; $i < $lenConv; $i++) {
        $digit     = (int)$converted[$i];
        $remainder = ($remainder * 10 + $digit) % 97;
    }

    return $remainder === 1;
}

// 1) Form-Daten einsammeln & trimmen
$fullName   = trim($_POST['full_name'] ?? '');
$email      = trim($_POST['email'] ?? '');
$phone      = trim($_POST['phone'] ?? '');
$birthdate  = trim($_POST['birthdate'] ?? '');
$street     = trim($_POST['street'] ?? '');
$zip        = trim($_POST['zip'] ?? '');
$city       = trim($_POST['city'] ?? '');

$membership = trim($_POST['membership_type_code'] ?? '');
$style      = trim($_POST['style'] ?? '');
$entryDate  = trim($_POST['entry_date'] ?? '');
$remarks    = trim($_POST['remarks'] ?? '');

$isMinor          = isset($_POST['is_minor']) ? 1 : 0;
$guardianName     = trim($_POST['guardian_name'] ?? '');
$guardianRelation = trim($_POST['guardian_relation'] ?? '');
$guardianEmail    = trim($_POST['guardian_email'] ?? '');
$guardianPhone    = trim($_POST['guardian_phone'] ?? '');

$sepaAccountHolder = trim($_POST['sepa_account_holder'] ?? '');
$sepaIban          = trim($_POST['sepa_iban'] ?? '');
$sepaBic           = trim($_POST['sepa_bic'] ?? '');
$sepaOk            = isset($_POST['sepa_ok']) ? 1 : 0;

$privacyOk         = isset($_POST['privacy_ok']) ? 1 : 0;

// 2) Basis-Validierung + Plausibilitätsregeln
$errors   = [];
$warnings = [];

// Mapping für schöne Fehlermeldungen
$errorMessages = [
    'full_name_required'            => 'Bitte geben Sie Ihren vollständigen Namen an.',
    'birthdate_required'            => 'Bitte geben Sie Ihr Geburtsdatum an.',
    'birthdate_invalid'             => 'Bitte geben Sie ein gültiges Geburtsdatum ein.',
    'street_required'               => 'Bitte geben Sie Ihre Straße und Hausnummer an.',
    'zip_required'                  => 'Bitte geben Sie Ihre Postleitzahl an.',
    'city_required'                 => 'Bitte geben Sie Ihren Wohnort an.',
    'phone_required'                => 'Bitte geben Sie eine Telefonnummer an.',
    'email_required'                => 'Bitte geben Sie eine E-Mail-Adresse an.',
    'email_invalid'                 => 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
    'membership_required'           => 'Bitte wählen Sie eine Mitgliedschaft.',
    'entry_date_required'           => 'Bitte wählen Sie einen Eintrittstermin.',
    'entry_date_invalid'            => 'Der gewählte Eintrittstermin ist nicht gültig.',
    'privacy_required'              => 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    'minor_checkbox_required'       => 'Bei minderjährigen Mitgliedern muss das Feld „Ich bin minderjährig“ markiert sein.',
    'guardian_name_required'        => 'Bei minderjährigen Mitgliedern muss ein gesetzlicher Vertreter eingetragen werden.',
    'guardian_email_invalid'        => 'Die E-Mail-Adresse des gesetzlichen Vertreters ist nicht gültig.',
    'sepa_ok_required'              => 'Wenn eine IBAN eingetragen ist, muss das SEPA-Lastschriftmandat bestätigt werden.',
    'sepa_iban_required'            => 'Wenn ein SEPA-Mandat erteilt wird, muss eine IBAN eingetragen werden.',
    'sepa_account_holder_required'  => 'Wenn ein SEPA-Mandat erteilt wird, muss der Kontoinhaber eingetragen werden.',
    'sepa_iban_invalid'             => 'Die angegebene IBAN ist nicht gültig.',
    'photo_invalid'                 => 'Das hochgeladene Foto konnte nicht verarbeitet werden.',

];

// Pflichtfelder (hart)
if ($fullName === '') {
    $errors[] = 'full_name_required';
}

if ($birthdate === '') {
    $errors[] = 'birthdate_required';
}

if ($street === '') {
    $errors[] = 'street_required';
}
if ($zip === '') {
    $errors[] = 'zip_required';
}
if ($city === '') {
    $errors[] = 'city_required';
}

if ($phone === '') {
    $errors[] = 'phone_required';
}

if ($email === '') {
    $errors[] = 'email_required';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'email_invalid';
}

if ($membership === '') {
    $errors[] = 'membership_required';
}
if ($entryDate === '') {
    $errors[] = 'entry_date_required';
}
if (!$privacyOk) {
    $errors[] = 'privacy_required';
}

// Eintrittstermin gegen Tenant-Konfiguration prüfen
if ($entryDate !== '') {
    try {
        $dt = new DateTime($entryDate);

        // Zulässige Tage laden (gleiche Logik wie im Formular)
        $allowedDays = app_getAllowedEntryDays($pdo, $tenantId);

        $day   = (int)$dt->format('j');
        $today = new DateTime('today');

        $isAllowedDay = in_array($day, $allowedDays, true);
        $isInFuture   = $dt >= $today;

        if (!$isAllowedDay || !$isInFuture) {
            $errors[] = 'entry_date_invalid';
        }
    } catch (Exception $e) {
        $errors[] = 'entry_date_invalid';
    }
}

// Alter berechnen, wenn Geburtsdatum vorhanden
$age = null;
if ($birthdate !== '') {
    try {
        $dob = new DateTime($birthdate);
        $now = new DateTime('today');

        if ($dob > $now) {
            $errors[] = 'birthdate_invalid';
        } else {
            $diff = $dob->diff($now);
            $age  = $diff->y;

            if ($age > 120) {
                $errors[] = 'birthdate_invalid';
            }
        }
    } catch (Exception $e) {
        $errors[] = 'birthdate_invalid';
    }
}

// --- Minderjährigen-Regeln (hart) ---
// Wenn Alter < 18 → Checkbox MUSS gesetzt sein
if ($age !== null && $age < 18) {
    if (!$isMinor) {
        $errors[] = 'minor_checkbox_required';
    }
}

// Wenn Checkbox „minderjährig“ gesetzt ist → Vertreter Pflicht
if ($isMinor) {
    if ($guardianName === '') {
        $errors[] = 'guardian_name_required';
    }
}

// Vertreter-E-Mail prüfen, wenn eingetragen
if ($guardianEmail !== '' && !filter_var($guardianEmail, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'guardian_email_invalid';
}

// Fall: Geburtsdatum sagt volljährig, Checkbox trotzdem gesetzt → nur Warnung
if ($age !== null && $age >= 18 && $isMinor) {
    $warnings[] = 'minor_flag_maybe_wrong';
}

// --- SEPA-Regeln (hart) ---
// 1. Wenn IBAN eingetragen, MUSS SEPA-Häkchen gesetzt sein
if ($sepaIban !== '' && !$sepaOk) {
    $errors[] = 'sepa_ok_required';
}

// 2. Wenn SEPA-Häkchen gesetzt, müssen IBAN + Kontoinhaber vorhanden sein
if ($sepaOk && $sepaIban === '') {
    $errors[] = 'sepa_iban_required';
}
if ($sepaOk && $sepaAccountHolder === '') {
    $errors[] = 'sepa_account_holder_required';
}

// 3. IBAN-Format / Mod97 prüfen, wenn eine IBAN eingetragen ist
if ($sepaIban !== '') {
    if (!isValidIban($sepaIban)) {
        $errors[] = 'sepa_iban_invalid';
    }
}

// Upload-Mitgliedsfoto (optional)
$photoPath = null;

if (!empty($_FILES['photo']['tmp_name']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {

    $tmpName  = $_FILES['photo']['tmp_name'];
    $origName = $_FILES['photo']['name'] ?? 'photo.jpg';

    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        $ext = 'jpg';
    }

    // uploads/<tenant_id>/photos/
    $baseDir = __DIR__ . '/uploads/' . $tenantId . '/photos';

    if (!is_dir($baseDir)) {
        mkdir($baseDir, 0775, true);
    }

    $fileName   = 'photo_' . $tenantId . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $targetPath = $baseDir . '/' . $fileName;

    if (move_uploaded_file($tmpName, $targetPath)) {
        // relativer Pfad für die DB
        $photoPath = 'uploads/' . $tenantId . '/photos/' . $fileName;
    }
}



// Wenn Fehler → Meldungen und Formwerte in Session legen und zurück zum Formular
if (!empty($errors)) {
    // Menschige Fehlermeldungen bauen (Duplikate vermeiden)
    $displayErrors = [];
    foreach (array_unique($errors) as $code) {
        $displayErrors[] = $errorMessages[$code] ?? $code;
    }

    // Formwerte für Prefill sammeln
    $formData = [
        'full_name'            => $fullName,
        'email'                => $email,
        'phone'                => $phone,
        'birthdate'            => $birthdate,
        'street'               => $street,
        'zip'                  => $zip,
        'city'                 => $city,
        'membership_type_code' => $membership,
        'style'                => $style,
        'entry_date'           => $entryDate,
        'remarks'              => $remarks,
        'is_minor'             => $isMinor,
        'guardian_name'        => $guardianName,
        'guardian_relation'    => $guardianRelation,
        'guardian_email'       => $guardianEmail,
        'guardian_phone'       => $guardianPhone,
        'sepa_account_holder'  => $sepaAccountHolder,
        'sepa_iban'            => $sepaIban,
        'sepa_bic'             => $sepaBic,
        'sepa_ok'              => $sepaOk,
        'privacy_ok'           => $privacyOk,
    ];

    $_SESSION['form_data']   = $formData;
    $_SESSION['form_errors'] = $displayErrors;

    header('Location: /index.php');
    exit;
}


// 3) Flags & Zeitstempel bauen
$hasWarnings  = !empty($warnings) ? 1 : 0;
$sepaConsent  = $sepaOk ? (new DateTime())->format('Y-m-d H:i:s') : null;
$gdprConsent  = $privacyOk ? 1 : 0;

// 4) Datensatz speichern
$stmt = $pdo->prepare("
        INSERT INTO tbl_application (
        tenant_id,
        created_at,
        updated_at,
        status,
        full_name,
        email,
        phone,
        birthdate,
        street,
        zip,
        city,
        membership_type_code,
        style,
        entry_date,
        remarks,
        is_minor,
        guardian_name,
        guardian_relation,
        guardian_email,
        guardian_phone,
        sepa_account_holder,
        sepa_iban,
        sepa_bic,
        sepa_consent,
        gdpr_consent,
        has_warnings,
        photo_path
    ) VALUES (
        :tenant_id,
        NOW(),
        NOW(),
        'new',
        :full_name,
        :email,
        :phone,
        :birthdate,
        :street,
        :zip,
        :city,
        :membership_type_code,
        :style,
        :entry_date,
        :remarks,
        :is_minor,
        :guardian_name,
        :guardian_relation,
        :guardian_email,
        :guardian_phone,
        :sepa_account_holder,
        :sepa_iban,
        :sepa_bic,
        :sepa_consent,
        :gdpr_consent,
        :has_warnings,
        :photo_path
    )

");

$stmt->execute([
    ':tenant_id'            => $tenantId,
    ':full_name'            => $fullName,
    ':email'                => $email,
    ':phone'                => $phone,
    ':birthdate'            => ($birthdate !== '' ? $birthdate : null),
    ':street'               => $street,
    ':zip'                  => $zip,
    ':city'                 => $city,
    ':membership_type_code' => $membership,
    ':style'                => $style,
    ':entry_date'           => ($entryDate !== '' ? $entryDate : null),
    ':remarks'              => ($remarks !== '' ? $remarks : null),
    ':is_minor'             => $isMinor,
    ':guardian_name'        => $guardianName,
    ':guardian_relation'    => $guardianRelation,
    ':guardian_email'       => ($guardianEmail !== '' ? $guardianEmail : null),
    ':guardian_phone'       => ($guardianPhone !== '' ? $guardianPhone : null),
    ':sepa_account_holder'  => ($sepaAccountHolder !== '' ? $sepaAccountHolder : null),
    ':sepa_iban'            => ($sepaIban !== '' ? $sepaIban : null),
    ':sepa_bic'             => ($sepaBic !== '' ? $sepaBic : null),
    ':sepa_consent'         => $sepaConsent,
    ':gdpr_consent'         => $gdprConsent,
    ':has_warnings'         => $hasWarnings,
    ':photo_path'           => $photoPath,
]);

// 5) Event-Log (vereinfacht)
$appId = (int)$pdo->lastInsertId();
$stmtEvent = $pdo->prepare("
    INSERT INTO tbl_application_event (application_id, ts, event)
    VALUES (:app_id, NOW(), :event)
");
$eventPayload = json_encode([
    'type'     => 'created',
    'warnings' => $warnings,
], JSON_UNESCAPED_UNICODE);
$stmtEvent->execute([
    ':app_id' => $appId,
    ':event'  => $eventPayload,
]);

// 6) Weiterleiten auf Danke-Seite
header('Location: /thanks.html'); // ggf. thanks.php
exit;
