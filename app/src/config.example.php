<?php
// FillQR App – Konfiguration
// Kopiere diese Datei nach config.php und trage echte Zugangsdaten ein.
// config.php wird NICHT versioniert (.gitignore)!

// ----- Datenbank -----
const DB_HOST = 'localhost';
const DB_NAME = 'fillqr_db';
const DB_USER = 'fillqr_user';
const DB_PASS = 'CHANGE_ME';

// ----- reCAPTCHA v2 -----
const APP_RECAPTCHA_SITE_KEY = 'CHANGE_ME';
const APP_RECAPTCHA_SECRET   = 'CHANGE_ME';

// Im DEV: Fehler anzeigen
ini_set('display_errors', 1);
error_reporting(E_ALL);
