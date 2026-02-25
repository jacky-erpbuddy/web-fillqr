<?php
// /admin/login.php — Admin Login
require_once __DIR__ . '/../../src/app.php';
session_start();

$pdo      = db();
$tenantId = resolveTenantIdByHost($pdo);

// Already logged in?
if (!empty($_SESSION['admin_user_id']) && $_SESSION['admin_tenant_id'] === $tenantId) {
    header('Location: /admin/');
    exit;
}

$error = '';

// Rate limiting: max 5 attempts per 15 minutes per IP
$maxAttempts = 5;
$windowSec   = 900;
if (!isset($_SESSION['login_attempts'])) {
    $_SESSION['login_attempts'] = [];
}
// Clean old attempts
$_SESSION['login_attempts'] = array_filter(
    $_SESSION['login_attempts'],
    fn($ts) => $ts > time() - $windowSec
);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // CSRF check
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
        $error = 'Ungueltige Anfrage. Bitte erneut versuchen.';
    } elseif (count($_SESSION['login_attempts']) >= $maxAttempts) {
        $error = 'Zu viele Anmeldeversuche. Bitte in einigen Minuten erneut versuchen.';
    } else {
        $email    = trim($_POST['email'] ?? '');
        $password = stripslashes($_POST['password'] ?? '');

        $stmt = $pdo->prepare('
            SELECT id, email, pass_hash, role
            FROM tbl_app_user
            WHERE tenant_id = ? AND email = ?
            LIMIT 1
        ');
        $stmt->execute([$tenantId, $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['pass_hash'])) {
            // Success — regenerate session ID
            session_regenerate_id(true);
            $_SESSION['admin_user_id']  = $user['id'];
            $_SESSION['admin_email']    = $user['email'];
            $_SESSION['admin_role']     = $user['role'];
            $_SESSION['admin_tenant_id'] = $tenantId;
            $_SESSION['login_attempts'] = [];

            header('Location: /admin/');
            exit;
        }

        // Failed — record attempt, generic error
        $_SESSION['login_attempts'][] = time();
        $error = 'E-Mail oder Passwort falsch.';
    }
}

// CSRF token
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = $_SESSION['csrf_token'];

// Tenant name for display
$stmt = $pdo->prepare('SELECT name FROM tbl_tenant WHERE id = ?');
$stmt->execute([$tenantId]);
$tenantName = $stmt->fetchColumn() ?: 'Verein';

$pageTitle = 'Admin-Login — ' . $tenantName;
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= htmlspecialchars($pageTitle) ?></title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/assets/css/base.css?v=3">
</head>
<body>
  <div class="page" style="max-width: 440px; margin-top: 10vh;">
    <div class="card">
      <h1 style="text-align:center; margin-bottom: var(--spacing-md);">Admin-Login</h1>
      <p class="subtitle" style="text-align:center;">
        <?= htmlspecialchars($tenantName) ?>
      </p>

      <?php if ($error): ?>
        <div class="error-box" style="margin-bottom: var(--spacing-md);">
          <strong><?= htmlspecialchars($error) ?></strong>
        </div>
      <?php endif; ?>

      <?php if (($_GET['error'] ?? '') === 'tenant'): ?>
        <div class="error-box" style="margin-bottom: var(--spacing-md);">
          <strong>Zugriff verweigert. Bitte erneut anmelden.</strong>
        </div>
      <?php endif; ?>

      <form method="post" action="/admin/login.php">
        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">

        <div class="field">
          <label for="email">E-Mail</label>
          <input type="email" id="email" name="email" required autofocus
                 value="<?= htmlspecialchars($_POST['email'] ?? '') ?>">
        </div>

        <div class="field">
          <label for="password">Passwort</label>
          <input type="password" id="password" name="password" required>
        </div>

        <div class="actions" style="justify-content: center; margin-top: var(--spacing-lg);">
          <button type="submit" class="btn-primary">
            <span>Anmelden</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>
