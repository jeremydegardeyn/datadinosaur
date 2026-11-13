<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/** Send a plain-text email to one recipient through the site's SMTP relay. */
function send_site_email(string $to, string $subject, string $body, array $headers = []): bool
{
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = getenv('SMTP_HOST')       ?: 'localhost';
        $mail->Port       = (int)(getenv('SMTP_PORT') ?: 587);
        $mail->SMTPAuth   = (getenv('SMTP_USER') ?: '') !== '';
        $mail->Username   = getenv('SMTP_USER')       ?: '';
        $mail->Password   = getenv('SMTP_PASS')       ?: '';
        $mail->SMTPSecure = $mail->SMTPAuth ? PHPMailer::ENCRYPTION_STARTTLS : '';
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom(getenv('SMTP_FROM_EMAIL') ?: 'noreply@datadinosaur.com',
                       getenv('SMTP_FROM_NAME')  ?: 'DataDinosaur');
        $mail->addAddress($to);
        foreach ($headers as $k => $v) $mail->addCustomHeader($k, $v);
        $mail->isHTML(false);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('PHPMailer error: ' . $mail->ErrorInfo);
        return false;
    }
}

function send_contact_email(array $data): bool
{
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = getenv('SMTP_HOST')       ?: 'localhost';
        $mail->Port       = (int)(getenv('SMTP_PORT') ?: 587);
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('SMTP_USER')       ?: '';
        $mail->Password   = getenv('SMTP_PASS')       ?: '';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;

        $from_email = getenv('SMTP_FROM_EMAIL') ?: 'noreply@datadinosaur.com';
        $from_name  = getenv('SMTP_FROM_NAME')  ?: 'DataDinosaur';
        $to_email   = getenv('CONTACT_TO_EMAIL') ?: 'jeremy@datadinosaur.com';

        $mail->setFrom($from_email, $from_name);
        $mail->addAddress($to_email);
        $mail->addReplyTo($data['email'], $data['name']);

        $mail->isHTML(false);
        $mail->Subject = '[DataDinosaur] ' . $data['subject'];
        $mail->Body    = sprintf(
            "From: %s <%s>\nCompany: %s\nType: %s\n\n---\n\n%s",
            $data['name'],
            $data['email'],
            $data['company'] ?? 'N/A',
            $data['type']    ?? 'General',
            $data['message']
        );

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('PHPMailer error: ' . $mail->ErrorInfo);
        return false;
    }
}
