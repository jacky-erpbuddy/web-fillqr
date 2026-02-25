<?php
// /admin/auth.php — Session-based auth guard
// Include this AFTER session_start() and db() in every admin page.

if (empty($_SESSION['admin_user_id']) || empty($_SESSION['admin_tenant_id'])) {
    header('Location: /admin/login.php');
    exit;
}

// Tenant isolation: admin must belong to the current tenant
if ($_SESSION['admin_tenant_id'] !== $tenantId) {
    session_destroy();
    header('Location: /admin/login.php?error=tenant');
    exit;
}
