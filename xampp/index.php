<?php
declare(strict_types=1);
define('SIGEIA_APP', true);
require __DIR__ . '/private/bootstrap.php';
try {
    $mode = mode();
    if ($mode === 'pilot' && count(users()) === 0) { header('Location: configurar.php'); exit; }
    $html = file_get_contents(__DIR__ . '/app.html');
    if ($html === false) throw new RuntimeException('No está la interfaz compilada.');
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $endpoint = htmlspecialchars('./api.php?mode=' . $mode . '&route=', ENT_QUOTES, 'UTF-8');
    echo str_replace('<head>', '<head><meta name="sigeia-api" content="'.$endpoint.'">', $html);
} catch (Throwable $error) { error_log('SIGEIA: '.$error->getMessage()); http_response_code(500); echo 'No se pudo iniciar SIGEIA. Consulta LEEME-XAMPP.md y los registros de Apache/PHP.'; }
