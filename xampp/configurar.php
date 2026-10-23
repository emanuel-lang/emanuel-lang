<?php
declare(strict_types=1);
define('SIGEIA_APP', true);
require __DIR__ . '/private/bootstrap.php';
if (!local_request()) { http_response_code(403); exit('La configuración inicial solo se permite desde localhost.'); }
try {
    session_init();
    $configured = count(users()) > 0;
    $_SESSION['setup_csrf'] ??= bin2hex(random_bytes(24));
    $error = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        require_same_origin();
        if (!is_string($_POST['csrf'] ?? null) || !hash_equals($_SESSION['setup_csrf'], $_POST['csrf'])) { http_response_code(403); exit('Solicitud inválida. Recarga la página.'); }
        if ($configured) { http_response_code(409); exit('La instalación ya tiene una cuenta.'); }
        $username = $_POST['username'] ?? null;
        $password = $_POST['password'] ?? null;
        $confirmation = $_POST['confirmation'] ?? null;
        if (!is_string($username) || !preg_match('/^[a-zA-Z0-9_.@-]{3,80}$/D', $username)) $error = 'Usuario inválido: usa de 3 a 80 letras, números o los signos _.@-';
        elseif (!is_string($password) || strlen($password)<14 || strlen($password)>72) $error = 'La contraseña debe tener entre 14 y 72 bytes (usa caracteres ASCII para contar uno por carácter).';
        elseif ($password !== $confirmation) $error = 'Las contraseñas no coinciden.';
        else {
            with_json(storage_root().'/users.json', [], function(&$value) use($username,$password) {
                if (count($value)>0) throw new RuntimeException('La configuración ya fue completada.');
                $value[] = ['username'=>$username, 'role'=>'admin', 'passwordHash'=>password_hash($password, PASSWORD_DEFAULT)];
            });
            session_regenerate_id(true); $_SESSION = [];
            header('Location: index.php?mode=pilot'); exit;
        }
    }
    header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
} catch (Throwable $error) { error_log('SIGEIA: '.$error->getMessage()); http_response_code(500); exit('No se pudo preparar el almacenamiento privado fuera de htdocs. Revisa LEEME-XAMPP.md y los permisos del usuario de Apache.'); }
function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES, 'UTF-8'); }
?>
<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Configurar SIGEIA · XAMPP</title><link rel="stylesheet" href="configurar.css"></head><body><main><span class="eyebrow">SIGEIA · XAMPP</span><h1><?= $configured ? 'Tu piloto está configurado.' : 'Comienza tu piloto privado.' ?></h1><p>La demostración y el piloto tienen datos separados. No hay contraseñas predeterminadas.</p>
<?php if ($configured): ?><div class="notice">La creación de la primera cuenta está cerrada. Puedes iniciar sesión con tu cuenta existente.</div><a class="button" href="index.php?mode=pilot">Abrir piloto privado</a>
<?php else: ?><p>Crea la primera cuenta de administración. Este formulario solo funciona desde localhost y se cierra después de crearla.</p><form method="post" autocomplete="off"><input type="hidden" name="csrf" value="<?=e($_SESSION['setup_csrf'])?>"><label>Usuario<input name="username" required minlength="3" maxlength="80" pattern="[a-zA-Z0-9_.@\-]+" autocomplete="username"></label><label>Contraseña<input name="password" type="password" required minlength="14" maxlength="72" autocomplete="new-password"></label><label>Repite la contraseña<input name="confirmation" type="password" required minlength="14" maxlength="72" autocomplete="new-password"></label><p class="error" role="alert"><?=e($error)?></p><button type="submit">Crear cuenta y abrir el piloto</button></form><?php endif; ?>
<a class="secondary" href="index.php?mode=demo">Ver demostración con datos ficticios →</a><small>Evaluación local · Sin Node.js ni MySQL · PHP 8.1 o superior</small></main></body></html>
