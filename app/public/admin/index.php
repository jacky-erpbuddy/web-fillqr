<?php
// /demo/public/admin/index.php
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

// --------------------------------------------------
// Filter aus GET lesen
// --------------------------------------------------

// Status-Filter
$statusFilter  = $_GET['status'] ?? '';
$allowedStatus = ['new', 'reviewed', 'exported', 'archived'];
$filterStatus  = in_array($statusFilter, $allowedStatus, true) ? $statusFilter : '';

// Zeitraum-Filter (YYYY-MM-DD)
$dateFrom = trim($_GET['date_from'] ?? '');
$dateTo   = trim($_GET['date_to'] ?? '');

// Einfaches Suchfeld für Name / E-Mail
$search = trim($_GET['search'] ?? '');

// --------------------------------------------------
// SQL mit optionalen Filtern aufbauen
// --------------------------------------------------
$sql = "
    SELECT
        id,
        created_at,
        status,
        full_name,
        email,
        phone,
        birthdate,
        street,
        zip,
        city,
        style,
        membership_type_code,
        entry_date,
        is_minor,
        has_warnings
    FROM tbl_application
    WHERE tenant_id = :tenant_id
";

$params = [':tenant_id' => $tenantId];

// Statusfilter
if ($filterStatus !== '') {
    $sql .= " AND status = :status";
    $params[':status'] = $filterStatus;
}

// Zeitraumfilter
if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $sql .= " AND created_at >= :date_from";
    $params[':date_from'] = $dateFrom . ' 00:00:00';
}

if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $dt = DateTime::createFromFormat('Y-m-d', $dateTo);
    if ($dt) {
        $dt->modify('+1 day');
        $sql .= " AND created_at < :date_to";
        $params[':date_to'] = $dt->format('Y-m-d') . ' 00:00:00';
    }
}

// Suche in Name/E-Mail
if ($search !== '') {
    $sql .= " AND (full_name LIKE :search OR email LIKE :search)";
    $params[':search'] = '%' . $search . '%';
}

$sql .= " ORDER BY created_at DESC LIMIT 50";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Mitgliedsanträge – <?= htmlspecialchars($tenantName) ?></title>
  <meta name="viewport" content="width=device-width,initial-scale=1">

  <!-- gemeinsame Basis-Styles -->
  <link rel="stylesheet" href="/assets/css/base.css?v=1">

  <!-- Admin-spezifische Styles – bauen auf base.css auf -->
  <style>
    /* Seite etwas breiter als das Formular */
    .page--admin {
      max-width: 980px;
      margin: 0 auto;
    }

    /* Karte im Admin etwas kompakter */
    .card--admin {
      padding: 16px 16px 20px;
    }

    h1 {
      margin: 0 0 4px;
      font-size: 1.6rem;
    }

    .subtitle {
      margin: 0 0 8px;
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }

    /* Filterleiste */
    .filter-bar {
      margin: 0 0 12px;
      font-size: 0.9rem;
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
      padding: 4px 8px;
      font: inherit;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: #fff;
      min-width: 120px;
    }

    .btn-small {
      padding: 5px 12px;
      font: inherit;
      font-size: 0.85rem;
      border-radius: 999px;
      border: none;
      background: var(--color-primary);
      color: #fff;
      cursor: pointer;
    }

    .btn-small:hover {
      background: var(--color-primary-dk);
    }

    .link-reset {
      font-size: 0.8rem;
      color: var(--color-text-muted);
      text-decoration: none;
    }
    .link-reset:hover {
      text-decoration: underline;
    }

    /* Tabelle + Wrapper (für Desktop / großes Layout) */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    thead {
      background: #f1f3f8;
    }

    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e1e4ec;
      text-align: left;
      vertical-align: top;
    }

    tbody tr:nth-child(2n) {
      background: #fafbff;
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

    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 0.7rem;
      border: 1px solid #ced4da;
      color: #495057;
      background: #fff;
    }

    .muted {
      color: var(--color-text-muted);
      font-size: 0.8rem;
    }

    .nowrap {
      white-space: nowrap;
    }

    a {
      color: var(--color-primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
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

      /* Filterleiste untereinander */
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

      /* Tabellenkopf & Desktop-Zeilen ausblenden */
      thead {
        display: none;
      }

      tbody tr.app-row-desktop {
        display: none;
      }

      tbody tr.app-row-mobile {
        display: table-row;
      }

      /* Abstand zwischen Karten */
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
        border-radius: 12px;
        padding: 10px 12px;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
        border: 1px solid var(--color-border);
      }

      .app-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .app-card-id {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text-muted);
      }

      .app-card-main {
        font-size: 0.95rem;
        margin-bottom: 4px;
      }

      .app-card-main .muted {
        font-size: 0.8rem;
      }

      .app-card-meta {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        margin-bottom: 4px;
      }

      .app-card-secondary {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        margin-bottom: 6px;
      }

      .app-card-secondary div {
        margin-bottom: 2px;
      }

      .app-card-actions {
        display: flex;
        justify-content: flex-end;
        font-size: 0.85rem;
      }
    }

    /* ganz kleines Handy: Schrift noch etwas kleiner */
    @media (max-width: 640px) {
      table,
      thead,
      tbody,
      tr,
      td,
      th {
        font-size: 0.8rem;
      }
    }
  </style>

</head>

<body>
  <div class="page page--admin">
    <div class="header-row">
      <div>
        <h1>Mitgliedsanträge</h1>
        <p class="subtitle">
          Verein: <strong><?= htmlspecialchars($tenantName) ?></strong> –
          es werden die letzten 50 Anträge (nach Filtern) angezeigt.
        </p>
      </div>
      <div class="header-right">
        <?php if ($tenantLogo): ?>
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

      <!-- Filterleiste -->
      <form method="get" class="filter-bar">
        <div class="filter-group">
          <label for="status">Status</label>
          <select id="status" name="status">
            <option value="">Alle</option>
            <option value="new"      <?= $filterStatus === 'new'      ? 'selected' : '' ?>>Neu</option>
            <option value="reviewed" <?= $filterStatus === 'reviewed' ? 'selected' : '' ?>>Geprüft</option>
            <option value="exported" <?= $filterStatus === 'exported' ? 'selected' : '' ?>>Exportiert</option>
            <option value="archived" <?= $filterStatus === 'archived' ? 'selected' : '' ?>>Archiviert</option>
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
                $pillClass = $hasWarn ? 'status-warn' : 'status-new';
              ?>

              <!-- Desktop-Zeile -->
              <tr class="app-row-desktop">
                <td class="nowrap">
                  <a href="detail.php?id=<?= $rowId ?>">
                    #<?= $rowId ?>
                  </a>
                </td>
                <td class="nowrap">
                  <?= htmlspecialchars(substr($row['created_at'], 0, 16)) ?>
                </td>
                <td>
                  <span class="status-pill <?= $pillClass ?>">
                    <?= htmlspecialchars($status) ?>
                    <?php if ($hasWarn): ?>
                      · ⚠ Hinweise
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
                      geb. <?= htmlspecialchars($row['birthdate']) ?>
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
                    <?= htmlspecialchars($row['entry_date']) ?>
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
                        <?= htmlspecialchars($status) ?>
                        <?php if ($hasWarn): ?>
                          · ⚠ Hinweise
                        <?php endif; ?>
                      </span>
                    </div>

                    <div class="app-card-main">
                      <strong><?= htmlspecialchars($row['full_name']) ?></strong>
                      <?php if (!empty($row['birthdate']) || $isMinor): ?>
                        <div class="muted">
                          <?php if (!empty($row['birthdate'])): ?>
                            geb. <?= htmlspecialchars($row['birthdate']) ?>
                          <?php endif; ?>
                          <?php if ($isMinor): ?>
                            <?= !empty($row['birthdate']) ? ' · ' : '' ?>Minderjährig
                          <?php endif; ?>
                        </div>
                      <?php endif; ?>
                    </div>

                    <div class="app-card-meta">
                      <span><?= htmlspecialchars(substr($row['created_at'], 0, 16)) ?></span>
                      <?php if (!empty($row['entry_date'])): ?>
                        <span>Eintritt: <?= htmlspecialchars($row['entry_date']) ?></span>
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
      <?php endif; ?>
    </div>
  </div>
</body>
</html>
