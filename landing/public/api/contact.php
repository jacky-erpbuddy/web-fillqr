<?php
/**
 * FillQR Contact Form Proxy
 * Forwards form data to n8n webhook with authentication
 * Credentials stored in .env (not in browser-visible code)
 */

// Load .env from project root (outside public/)
$envFile = dirname(__DIR__, 2) . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '#') === 0) continue; // Skip comments
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value, '"\'');
    }
}

// Get credentials from .env
$webhookUrl = $_ENV['N8N_WEBHOOK_URL'] ?? '';
$webhookUser = $_ENV['N8N_WEBHOOK_USER'] ?? '';
$webhookPass = $_ENV['N8N_WEBHOOK_PASS'] ?? '';

// Validate configuration
if (empty($webhookUrl) || empty($webhookUser) || empty($webhookPass)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Server configuration error']);
    exit;
}

// CORS - only allow from fillqr.de
$allowedOrigins = ['https://fillqr.de', 'https://www.fillqr.de'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get POST data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

// Forward to n8n webhook with Basic Auth
$ch = curl_init($webhookUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $input,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Basic ' . base64_encode("$webhookUser:$webhookPass")
    ],
    CURLOPT_TIMEOUT => 30
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Handle curl error
if ($error) {
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'Connection error']);
    exit;
}

// Forward response
http_response_code($httpCode);
echo $response ?: json_encode(['success' => $httpCode >= 200 && $httpCode < 300]);
