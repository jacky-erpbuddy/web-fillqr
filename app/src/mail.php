<?php
/**
 * FillQR Mail-Helper — SMTP-Versand via PHPMailer.
 *
 * Nutzt Variomedia SMTP statt PHP mail() fuer bessere Zustellbarkeit
 * (SPF/DKIM/DMARC alignment).
 *
 * Voraussetzung: SMTP_* Konstanten in config.php definiert.
 */

require_once __DIR__ . '/../lib/PHPMailer/Exception.php';
require_once __DIR__ . '/../lib/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * Sendet eine HTML-E-Mail ueber SMTP.
 *
 * @param string      $to        Empfaenger-Adresse
 * @param string      $subject   Betreff (Klartext, wird UTF-8-kodiert)
 * @param string      $body      HTML-Body
 * @param string|null $fromName  Absender-Name (Default: SMTP_FROM_NAME)
 * @param string|null $replyTo   Reply-To-Adresse (optional)
 * @return bool true bei Erfolg
 */
function app_sendMail(
    string $to,
    string $subject,
    string $body,
    ?string $fromName = null,
    ?string $replyTo = null
): bool {
    $mail = new PHPMailer(true);

    try {
        // SMTP-Konfiguration
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;
        $mail->CharSet    = 'UTF-8';

        // Absender
        $mail->setFrom(SMTP_FROM_EMAIL, $fromName ?? SMTP_FROM_NAME);
        if ($replyTo) {
            $mail->addReplyTo($replyTo);
        }

        // Empfaenger
        $mail->addAddress($to);

        // Inhalt
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('FillQR Mail-Fehler: ' . $mail->ErrorInfo);
        return false;
    }
}
