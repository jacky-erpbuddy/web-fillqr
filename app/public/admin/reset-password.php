<?php
// /admin/reset-password.php – Neues Passwort setzen
require_once __DIR__ . '/../../src/app.php';
session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

$tenant     = app_getTenant($pdo);
$tenantName = $tenant['name'] ?? 'Verein';
$theme      = $tenant['theme'] ?? [];

$token   = trim($_GET['token'] ?? $_POST['token'] ?? '');
$message = '';
$messageType = '';
$tokenValid  = false;

// Token pruefen
if ($token !== ''
    && !empty($_SESSION['pw_reset_token'])
    && hash_equals($_SESSION['pw_reset_token'], $token)
    && !empty($_SESSION['pw_reset_expires'])
    && $_SESSION['pw_reset_expires'] > time()
) {
    $tokenValid = true;
}

// CSRF token
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// Formular abgeschickt
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $tokenValid) {
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
        $message = 'Ungueltige Anfrage.';
        $messageType = 'error';
    } else {
        $password  = $_POST['password'] ?? '';
        $password2 = $_POST['password2'] ?? '';

        if (strlen($password) < 8) {
            $message = 'Das Passwort muss mindestens 8 Zeichen lang sein.';
            $messageType = 'error';
        } elseif ($password !== $password2) {
            $message = 'Die Passwoerter stimmen nicht ueberein.';
            $messageType = 'error';
        } else {
            $userId = $_SESSION['pw_reset_user_id'] ?? 0;
            $hash   = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("UPDATE tbl_app_user SET pass_hash = ? WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$hash, $userId, $tenantId]);

            // Token verbrauchen
            unset($_SESSION['pw_reset_token'], $_SESSION['pw_reset_user_id'], $_SESSION['pw_reset_expires']);

            $message = 'Ihr Passwort wurde erfolgreich geaendert. Sie koennen sich jetzt anmelden.';
            $messageType = 'success';
            $tokenValid = false; // Formular nicht mehr zeigen
        }
    }
}

$pageTitle = 'Passwort zuruecksetzen – ' . $tenantName;
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
      <h1 style="text-align:center; margin-bottom: var(--spacing-md);">Neues Passwort</h1>
      <p class="subtitle" style="text-align:center;">
        <?= htmlspecialchars($tenantName) ?>
      </p>

      <?php if ($message): ?>
        <div class="msg-box msg-box--<?= $messageType === 'error' ? 'error' : 'success' ?>">
          <?= htmlspecialchars($message) ?>
        </div>
      <?php endif; ?>

      <?php if ($tokenValid): ?>
        <form method="post">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
          <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">

          <div class="field">
            <label for="password">Neues Passwort</label>
            <input type="password" id="password" name="password" required minlength="8"
                   placeholder="Mindestens 8 Zeichen">
          </div>

          <div class="field">
            <label for="password2">Passwort wiederholen</label>
            <input type="password" id="password2" name="password2" required minlength="8">
          </div>

          <div class="actions" style="justify-content: center; margin-top: var(--spacing-lg);">
            <button type="submit" class="btn-primary">
              <span>Passwort speichern</span>
            </button>
          </div>
        </form>
      <?php elseif ($messageType !== 'success'): ?>
        <div class="msg-box msg-box--error">
          Der Link ist ungueltig oder abgelaufen. Bitte fordern Sie einen neuen Link an.
        </div>
      <?php endif; ?>

      <p style="text-align:center; margin-top: var(--spacing-md); font-size: var(--font-size-sm);">
        <a href="login.php" style="color: var(--color-text-muted);">Zum Login</a>
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
