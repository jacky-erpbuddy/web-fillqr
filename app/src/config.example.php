<?php
// FillQR App – Konfiguration
// Alle Secrets kommen aus .env (Projekt-Root, gitignored).
// Vorlage: .env.example
//
// Diese Datei NICHT bearbeiten für Zugangsdaten!
// → Stattdessen .env.example nach .env kopieren und ausfüllen.

// ----- .env laden -----
$envFile = dirname(__DIR__, 2) . '/.env';
if (!file_exists($envFile)) {
    die('FATAL: .env nicht gefunden. Siehe .env.example');
}
$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    if (strpos($line, '#') === 0) continue;
    if (strpos($line, '=') === false) continue;
    list($key, $value) = explode('=', $line, 2);
    $_ENV[trim($key)] = trim($value, '"\'');
}

// ----- Constants aus .env -----
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? '');
define('DB_USER', $_ENV['DB_USER'] ?? '');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');

define('APP_RECAPTCHA_SITE_KEY', $_ENV['RECAPTCHA_SITE_KEY'] ?? '');
define('APP_RECAPTCHA_SECRET',   $_ENV['RECAPTCHA_SECRET']   ?? '');

// optional: im DEV kurz Fehler anzeigen
ini_set('display_errors', 1);
error_reporting(E_ALL);
