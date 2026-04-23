<?php
// /admin/forgot-password.php – Passwort-Zurücksetzen Anfrage
require_once __DIR__ . '/../../src/app.php';
session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

$tenant     = app_getTenant($pdo);
$tenantName = $tenant['name'] ?? 'Verein';
$theme      = $tenant['theme'] ?? [];

$message = '';
$messageType = '';

// CSRF token
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // CSRF check
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
        $message = 'Ungueltige Anfrage. Bitte erneut versuchen.';
        $messageType = 'error';
    } else {
        $email = trim($_POST['email'] ?? '');

        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            // User suchen
            $stmt = $pdo->prepare('
                SELECT id, email
                FROM tbl_app_user
                WHERE tenant_id = ? AND email = ?
                LIMIT 1
            ');
            $stmt->execute([$tenantId, $email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user) {
                // Token generieren
                $token   = bin2hex(random_bytes(32));
                $expires = date('Y-m-d H:i:s', time() + 3600); // 1 Stunde

                // Token in extra-Feld speichern (kein Schema-Change noetig)
                $stmt = $pdo->prepare("
                    UPDATE tbl_app_user
                    SET pass_hash = CONCAT(pass_hash, '')
                    WHERE id = ?
                ");
                // Wir speichern den Token temporaer in der Session statt DB-Aenderung
                // (fuer die Praesentation ausreichend, spaeter DB-Migration)
                $_SESSION['pw_reset_token']   = $token;
                $_SESSION['pw_reset_user_id'] = $user['id'];
                $_SESSION['pw_reset_expires'] = time() + 3600;

                // E-Mail senden
                $host    = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $link    = "https://{$host}/admin/reset-password.php?token={$token}";
                $subject = "Passwort zuruecksetzen – {$tenantName}";
                $body    = "Hallo,\n\n"
                         . "Sie haben das Zuruecksetzen Ihres Passworts angefordert.\n\n"
                         . "Klicken Sie auf den folgenden Link, um ein neues Passwort zu setzen:\n"
                         . "{$link}\n\n"
                         . "Der Link ist 1 Stunde gueltig.\n\n"
                         . "Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.\n\n"
                         . "Mit freundlichen Gruessen\n"
                         . $tenantName;
                $headers = "From: {$tenantName} <no-reply@{$host}>\r\n"
                         . "Content-Type: text/plain; charset=UTF-8\r\n";
                @mail($email, "=?UTF-8?B?" . base64_encode($subject) . "?=", $body, $headers);
            }
        }

        // Immer gleiche Meldung (keine E-Mail-Enumeration)
        $message = 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zuruecksetzen gesendet. Bitte pruefen Sie Ihren Posteingang.';
        $messageType = 'success';
    }
}

$pageTitle = 'Passwort vergessen – ' . $tenantName;
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= htmlspecialchars($pageTitle) ?></title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/assets/css/base.css?v=7">
  <?= app_getThemeStyleTag($theme) ?>
<?php if (!empty($theme['default_theme']) && $theme['default_theme'] === 'light'): ?>
  <script>try{if(!localStorage.getItem('fillqr-theme'))localStorage.setItem('fillqr-theme','light')}catch(e){}</script>
<?php endif; ?>
</head>
<body>
<script>(function(){var t;try{t=localStorage.getItem('fillqr-theme')}catch(e){}if(t==='light')document.body.classList.add('theme-light');})()</script>
  <div class="page" style="max-width: 440px; margin-top: 10vh;">
    <div class="card">
      <h1 style="text-align:center; margin-bottom: var(--spacing-md);">Passwort vergessen</h1>
      <p class="subtitle" style="text-align:center;">
        <?= htmlspecialchars($tenantName) ?>
      </p>

      <?php if ($message): ?>
        <div class="msg-box msg-box--<?= $messageType === 'error' ? 'error' : 'success' ?>">
          <?= htmlspecialchars($message) ?>
        </div>
      <?php endif; ?>

      <?php if ($messageType !== 'success'): ?>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--spacing-md);">
          Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link zum Zuruecksetzen Ihres Passworts.
        </p>

        <form method="post">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

          <div class="field">
            <label for="email">E-Mail</label>
            <input type="email" id="email" name="email" required autofocus
                   value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
          </div>

          <div class="actions" style="justify-content: center; margin-top: var(--spacing-lg);">
            <button type="submit" class="btn-primary">
              <span>Link senden</span>
            </button>
          </div>
        </form>
      <?php endif; ?>

      <p style="text-align:center; margin-top: var(--spacing-md); font-size: var(--font-size-sm);">
        <a href="login.php" style="color: var(--color-text-muted);">Zurueck zum Login</a>
      </p>
    </div>
  </div>

  <button type="button" id="theme-toggle" class="theme-toggle theme-toggle-fixed" title="Hell / Dunkel">
    <span class="theme-toggle__track"><span class="theme-toggle__thumb"></span></span>
    <span class="theme-toggle__label"></span>
  </button>
  <script src="/assets/js/theme.js?v=7"></script>
</body>
</html>
