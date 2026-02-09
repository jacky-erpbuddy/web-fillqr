<?php
// FillQR App – DB-Konfiguration
// Kopiere diese Datei nach config.php und trage echte Zugangsdaten ein.
// config.php wird NICHT versioniert (.gitignore)!

const DB_HOST = 'localhost';
const DB_NAME = 'fillqr_db';
const DB_USER = 'fillqr_user';
const DB_PASS = 'CHANGE_ME';

// Im DEV: Fehler anzeigen
ini_set('display_errors', 1);
error_reporting(E_ALL);
