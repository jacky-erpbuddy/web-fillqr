<?php
// /demo/public/admin/index.php
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

// --------------------------------------------------
// Filter aus GET lesen
// --------------------------------------------------

// Status-Filter (aus zentraler Map)
$statusMap     = app_getStatusMap();
$statusFilter  = $_GET['status'] ?? '';
$filterStatus  = array_key_exists($statusFilter, $statusMap) ? $statusFilter : '';

// Zeitraum-Filter (YYYY-MM-DD)
$dateFrom = trim($_GET['date_from'] ?? '');
$dateTo   = trim($_GET['date_to'] ?? '');

// Einfaches Suchfeld für Name / E-Mail
$search = trim($_GET['search'] ?? '');

// --------------------------------------------------
// SQL mit optionalen Filtern aufbauen
// --------------------------------------------------
$whereExtra = '';
$params = [':tenant_id' => $tenantId];

// Statusfilter
if ($filterStatus !== '') {
    $whereExtra .= " AND status = :status";
    $params[':status'] = $filterStatus;
}

// Zeitraumfilter
if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $whereExtra .= " AND created_at >= :date_from";
    $params[':date_from'] = $dateFrom . ' 00:00:00';
}

if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $dt = DateTime::createFromFormat('Y-m-d', $dateTo);
    if ($dt) {
        $dt->modify('+1 day');
        $whereExtra .= " AND created_at < :date_to";
        $params[':date_to'] = $dt->format('Y-m-d') . ' 00:00:00';
    }
}

// Suche in Name/E-Mail
if ($search !== '') {
    $whereExtra .= " AND (full_name LIKE :search OR email LIKE :search)";
    $params[':search'] = '%' . $search . '%';
}

// Gesamtzahl für Paginierung
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM tbl_application WHERE tenant_id = :tenant_id" . $whereExtra);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

// Paginierung
$perPage    = 50;
$page       = max(1, (int)($_GET['page'] ?? 1));
$totalPages = max(1, (int)ceil($total / $perPage));
if ($page > $totalPages) $page = $totalPages;
$offset = ($page - 1) * $perPage;

// Hauptabfrage mit LIMIT/OFFSET
$sql = "
    SELECT id, created_at, status, full_name, email, phone, birthdate,
           street, zip, city, style, membership_type_code, entry_date,
           is_minor, has_warnings
    FROM tbl_application
    WHERE tenant_id = :tenant_id" . $whereExtra . "
    ORDER BY created_at DESC
    LIMIT $perPage OFFSET $offset
";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Mitglieder – <?= htmlspecialchars($tenantName) ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" type="image/png" href="/favicon.png">

  <!-- gemeinsame Basis-Styles -->
  <link rel="stylesheet" href="/assets/css/base.css?v=7">
  <?= app_getThemeStyleTag($theme) ?>
<?php if (!empty($theme['default_theme']) && $theme['default_theme'] === 'light'): ?>
  <script>try{if(!localStorage.getItem('fillqr-theme'))localStorage.setItem('fillqr-theme','light')}catch(e){}</script>
<?php endif; ?>

  <!-- Admin-spezifische Styles – bauen auf base.css auf -->
  <style>
    /* Seite etwas breiter als das Formular */
    .page--admin {
      max-width: 1280px;
      margin: 0 auto;
    }

    /* Karte im Admin etwas kompakter */
    .card--admin {
      padding: var(--spacing-md) var(--spacing-md) var(--spacing-lg);
    }

    /* Filterleiste */
    .filter-bar {
      margin: 0 0 var(--spacing-sm);
      font-size: var(--font-size-sm);
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .filter-bar label {
      font-weight: 600;
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }

    .filter-bar select,
    .filter-bar input[type="date"],
    .filter-bar input[type="text"] {
      padding: 6px 10px;
      font: inherit;
      font-size: var(--font-size-sm);
      min-width: 120px;
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

    .link-reset {
      font-size: 0.8rem;
      color: var(--color-text-muted);
      text-decoration: none;
    }
    .link-reset:hover {
      color: var(--color-cyan);
    }

    /* Tabelle + Wrapper */
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

    /* Paginierung */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-top: var(--spacing-md);
      padding-top: var(--spacing-sm);
      border-top: 1px solid var(--color-border);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .pagination a {
      color: var(--color-cyan);
      text-decoration: none;
      font-weight: 600;
    }
    .pagination a:hover {
      color: var(--color-green);
    }

    /* Standard: Desktop-Tabelle, Mobile-Karten verstecken */
    .app-row-mobile {
      display: none;
    }

    /* Handy/Tablet-Anpassungen */
    @media (max-width: 768px) {

      .page--admin {
        max-width: 100%;
      }

      .filter-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-group {
        width: 100%;
      }

      .filter-bar select,
      .filter-bar input[type="date"],
      .filter-bar input[type="text"] {
        width: 100%;
      }

      .filter-group:last-child {
        flex-direction: row;
        justify-content: flex-end;
        gap: 8px;
      }

      thead {
        display: none;
      }

      tbody tr.app-row-desktop {
        display: none;
      }

      tbody tr.app-row-mobile {
        display: table-row;
      }

      table {
        border-collapse: separate;
        border-spacing: 0 8px;
      }

      tbody tr.app-row-mobile td {
        border-bottom: none;
        padding: 0;
      }

      .app-card {
        background: var(--color-bg-card);
        border-radius: var(--radius-lg);
        padding: var(--spacing-sm) var(--spacing-md);
        box-shadow: var(--shadow-card);
        border: 1px solid var(--color-border);
        backdrop-filter: blur(10px);
      }

      .app-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: var(--spacing-xs);
      }

      .app-card-id {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-cyan);
      }

      .app-card-main {
        font-size: 0.95rem;
        margin-bottom: var(--spacing-xs);
      }

      .app-card-meta {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        margin-bottom: var(--spacing-xs);
      }

      .app-card-secondary {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        margin-bottom: var(--spacing-xs);
      }

      .app-card-secondary div {
        margin-bottom: 2px;
      }

      .app-card-actions {
        display: flex;
        justify-content: flex-end;
        font-size: var(--font-size-sm);
      }
    }

    @media (max-width: 640px) {
      table, thead, tbody, tr, td, th {
        font-size: 0.8rem;
      }
    }
  </style>

</head>

<body>
<script>(function(){var t;try{t=localStorage.getItem('fillqr-theme')}catch(e){}if(t==='light')document.body.classList.add('theme-light');})()</script>
  <div class="page page--admin">
    <nav class="admin-nav" style="display:flex;gap:16px;align-items:center;margin-bottom:var(--spacing-sm);font-size:0.85rem;">
      <a href="index.php" style="color:var(--color-cyan);font-weight:600;">Mitglieder</a>
      <a href="import.php" style="color:var(--color-text-muted);text-decoration:none;">CSV-Import</a>
      <span style="flex:1;"></span>
      <span style="color:var(--color-text-muted);font-size:0.8rem;"><?= htmlspecialchars($_SESSION['admin_email'] ?? '') ?></span>
      <a href="logout.php" style="color:var(--color-text-muted);text-decoration:none;">Abmelden</a>
    </nav>
    <div class="header-row">
      <div>
        <h1>Mitglieder</h1>
        <p class="subtitle">
          Verein: <strong><?= htmlspecialchars($tenantName) ?></strong>
          <?php if ($total > 0): ?>
            – <?= $total ?> Mitglied<?= $total === 1 ? '' : 'er' ?> gefunden
            <?php if ($totalPages > 1): ?>(Seite <?= $page ?> von <?= $totalPages ?>)<?php endif; ?>
          <?php endif; ?>
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

      <!-- Filterleiste -->
      <form method="get" class="filter-bar">
        <div class="filter-group">
          <label for="status">Status</label>
          <select id="status" name="status">
            <option value="">Alle</option>
            <?php foreach ($statusMap as $val => $label): ?>
              <option value="<?= $val ?>" <?= $filterStatus === $val ? 'selected' : '' ?>><?= htmlspecialchars($label) ?></option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="filter-group">
          <label for="date_from">Von (Eingang)</label>
          <input type="date" id="date_from" name="date_from"
                 value="<?= htmlspecialchars($dateFrom) ?>">
        </div>

        <div class="filter-group">
          <label for="date_to">Bis (Eingang)</label>
          <input type="date" id="date_to" name="date_to"
                 value="<?= htmlspecialchars($dateTo) ?>">
        </div>

        <div class="filter-group" style="flex:1; min-width:180px;">
          <label for="search">Suche (Name / E-Mail)</label>
          <input type="text" id="search" name="search"
                 placeholder="z. B. Müller oder name@example.de"
                 value="<?= htmlspecialchars($search) ?>">
        </div>

        <div class="filter-group">
          <button type="submit" class="btn-small">Filtern</button>
          <a href="index.php" class="link-reset">Filter zurücksetzen</a>
        </div>
      </form>

      <?php if (!$applications): ?>
        <p class="muted">Es liegen in dieser Ansicht keine Anträge vor.</p>
      <?php else: ?>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Datum</th>
                <th>Status</th>
                <th>Mitglied</th>
                <th>Kontakt</th>
                <th>Adresse</th>
                <th>Disziplin / Art</th>
                <th>Eintritt</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
            <?php foreach ($applications as $row): ?>
              <?php
                $rowId    = (int)$row['id'];
                $status   = (string)$row['status'];
                $hasWarn  = !empty($row['has_warnings']);
                $isMinor  = !empty($row['is_minor']);
                $pillClass = $hasWarn ? 'status-warn' : 'status-' . $status;
              ?>

              <!-- Desktop-Zeile -->
              <tr class="app-row-desktop">
                <td class="nowrap">
                  <a href="detail.php?id=<?= $rowId ?>">
                    #<?= $rowId ?>
                  </a>
                </td>
                <td class="nowrap">
                  <?= date('d.m.Y H:i', strtotime($row['created_at'])) ?>
                </td>
                <td>
                  <span class="status-pill <?= $pillClass ?>">
                    <?= htmlspecialchars(app_getStatusLabel($status)) ?>
                    <?php if ($hasWarn): ?>
                      · Hinweise
                    <?php endif; ?>
                  </span>

                  <?php if ($isMinor): ?>
                    <div class="muted">Minderjährig</div>
                  <?php endif; ?>
                </td>
                <td>
                  <strong><?= htmlspecialchars($row['full_name']) ?></strong>
                  <?php if (!empty($row['birthdate'])): ?>
                    <div class="muted">
                      geb. <?= date('d.m.Y', strtotime($row['birthdate'])) ?>
                    </div>
                  <?php endif; ?>
                </td>
                <td>
                  <?php if (!empty($row['email'])): ?>
                    <div><a href="mailto:<?= htmlspecialchars($row['email']) ?>">
                      <?= htmlspecialchars($row['email']) ?>
                    </a></div>
                  <?php endif; ?>
                  <?php if (!empty($row['phone'])): ?>
                    <div class="muted"><?= htmlspecialchars($row['phone']) ?></div>
                  <?php endif; ?>
                </td>
                <td>
                  <?php if (!empty($row['street'])): ?>
                    <div><?= htmlspecialchars($row['street']) ?></div>
                  <?php endif; ?>
                  <?php if (!empty($row['zip']) || !empty($row['city'])): ?>
                    <div class="muted">
                      <?= htmlspecialchars(trim(($row['zip'] ?? '') . ' ' . ($row['city'] ?? ''))) ?>
                    </div>
                  <?php endif; ?>
                </td>
                <td>
                  <?php if (!empty($row['style'])): ?>
                    <div class="badge"><?= htmlspecialchars($row['style']) ?></div>
                  <?php endif; ?>
                  <?php if (!empty($row['membership_type_code'])): ?>
                    <div class="muted">
                      Tarif: <?= htmlspecialchars($row['membership_type_code']) ?>
                    </div>
                  <?php endif; ?>
                </td>
                <td class="nowrap">
                  <?php if (!empty($row['entry_date'])): ?>
                    <?= date('d.m.Y', strtotime($row['entry_date'])) ?>
                  <?php else: ?>
                    <span class="muted">–</span>
                  <?php endif; ?>
                </td>
                <td class="nowrap">
                  <a href="detail.php?id=<?= $rowId ?>">Details</a>
                </td>
              </tr>

              <!-- Mobile-Karte -->
              <tr class="app-row-mobile">
                <td colspan="9">
                  <div class="app-card">
                    <div class="app-card-top">
                      <span class="app-card-id">#<?= $rowId ?></span>
                      <span class="status-pill <?= $pillClass ?>">
                        <?= htmlspecialchars(app_getStatusLabel($status)) ?>
                        <?php if ($hasWarn): ?>
                          · Hinweise
                        <?php endif; ?>
                      </span>
                    </div>

                    <div class="app-card-main">
                      <strong><?= htmlspecialchars($row['full_name']) ?></strong>
                      <?php if (!empty($row['birthdate']) || $isMinor): ?>
                        <div class="muted">
                          <?php if (!empty($row['birthdate'])): ?>
                            geb. <?= date('d.m.Y', strtotime($row['birthdate'])) ?>
                          <?php endif; ?>
                          <?php if ($isMinor): ?>
                            <?= !empty($row['birthdate']) ? ' · ' : '' ?>Minderjährig
                          <?php endif; ?>
                        </div>
                      <?php endif; ?>
                    </div>

                    <div class="app-card-meta">
                      <span><?= date('d.m.Y H:i', strtotime($row['created_at'])) ?></span>
                      <?php if (!empty($row['entry_date'])): ?>
                        <span>Eintritt: <?= date('d.m.Y', strtotime($row['entry_date'])) ?></span>
                      <?php endif; ?>
                    </div>

                    <div class="app-card-secondary">
                      <?php if (!empty($row['email'])): ?>
                        <div>E-Mail:
                          <a href="mailto:<?= htmlspecialchars($row['email']) ?>">
                            <?= htmlspecialchars($row['email']) ?>
                          </a>
                        </div>
                      <?php endif; ?>
                      <?php if (!empty($row['phone'])): ?>
                        <div>Tel.: <?= htmlspecialchars($row['phone']) ?></div>
                      <?php endif; ?>
                      <?php if (!empty($row['street']) || !empty($row['zip']) || !empty($row['city'])): ?>
                        <div>
                          Adresse:
                          <?= htmlspecialchars(trim(
                            ($row['street'] ?? '') . ', ' .
                            (($row['zip'] ?? '') . ' ' . ($row['city'] ?? ''))
                          )) ?>
                        </div>
                      <?php endif; ?>
                      <?php if (!empty($row['style']) || !empty($row['membership_type_code'])): ?>
                        <div>
                          <?php if (!empty($row['style'])): ?>
                            Sparte: <?= htmlspecialchars($row['style']) ?>
                          <?php endif; ?>
                          <?php if (!empty($row['membership_type_code'])): ?>
                            <?php if (!empty($row['style'])): ?> · <?php endif; ?>
                            Tarif: <?= htmlspecialchars($row['membership_type_code']) ?>
                          <?php endif; ?>
                        </div>
                      <?php endif; ?>
                    </div>

                    <div class="app-card-actions">
                      <a href="detail.php?id=<?= $rowId ?>">Details ansehen</a>
                    </div>
                  </div>
                </td>
              </tr>

            <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <?php if ($totalPages > 1): ?>
        <div class="pagination">
          <?php if ($page > 1): ?>
            <a href="?<?= htmlspecialchars(http_build_query(array_merge($_GET, ['page' => $page - 1]))) ?>">&larr; Zurück</a>
          <?php endif; ?>
          <span>Seite <?= $page ?> von <?= $totalPages ?></span>
          <?php if ($page < $totalPages): ?>
            <a href="?<?= htmlspecialchars(http_build_query(array_merge($_GET, ['page' => $page + 1]))) ?>">Weiter &rarr;</a>
          <?php endif; ?>
        </div>
        <?php endif; ?>

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
