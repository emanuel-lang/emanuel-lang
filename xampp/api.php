<?php
declare(strict_types=1);
define('SIGEIA_APP', true);
require __DIR__ . '/private/bootstrap.php';
require __DIR__ . '/private/framework.php';
require __DIR__ . '/private/business.php';
try {
    $mode = mode();
    $route = $_GET['route'] ?? '/';
    if (!is_string($route)) json_response(400, ['error'=>'Ruta inválida.']);
    $method = $_SERVER['REQUEST_METHOD'];
    if ($route === '/health' && $method === 'GET') { storage_root(); json_response(200, ['status'=>'ok', 'mode'=>$mode, 'runtime'=>'php']); }
    $mutating = !in_array($method, ['GET','HEAD'], true);
    if ($mutating) {
        if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) json_response(415, ['error'=>'Se requiere application/json.']);
        require_same_origin();
    }
    if ($route === '/auth/login' && $method === 'POST') {
        if ($mode === 'demo') json_response(400, ['error'=>'La demostración no requiere inicio de sesión.']);
        $input = read_body();
        if (!is_string($input['username'] ?? null) || !is_string($input['password'] ?? null) || strlen($input['username'])>80 || strlen($input['password'])>256) json_response(400, ['error'=>'Credenciales inválidas.']);
        session_init();
        $result = with_json(storage_root() . '/attempts.json', [], function(&$attempts) use ($input) {
            $now = time();
            $attempts = array_filter($attempts, fn($entry) => $now - $entry['since'] < 900);
            $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
            $entry = $attempts[$ip] ?? ['since'=>$now, 'count'=>0];
            if ($entry['count']>=10) return ['status'=>429];
            $found = null;
            foreach (users() as $user) if ($user['username'] === $input['username']) $found = $user;
            $fallback = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
            $valid = password_verify($input['password'], $found['passwordHash'] ?? $fallback);
            if (!$found || !$valid || strlen($input['password'])>72) {
                $entry['count']++; $attempts[$ip] = $entry; return ['status'=>401];
            }
            unset($attempts[$ip]); return ['status'=>200, 'user'=>$found];
        });
        if ($result['status'] !== 200) json_response($result['status'], ['error'=>$result['status']===429?'Demasiados intentos. Espera 15 minutos.':'Usuario o contraseña incorrectos.']);
        json_response(200, array_merge(begin_login($result['user']), ['mode'=>$mode]));
    }
    $user = $mode === 'demo' ? ['username'=>'Demostración', 'role'=>'admin', 'csrf'=>'demo'] : active_user();
    if (!$user) json_response(401, ['error'=>'Inicia sesión para continuar.', 'mode'=>$mode]);
    if ($route === '/auth/me' && $method === 'GET') json_response(200, array_merge($user, ['mode'=>$mode]));
    if ($mutating && !hash_equals($user['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) json_response(403, ['error'=>'Sesión inválida. Actualiza la página.']);
    if ($route === '/auth/logout' && $method === 'POST') {
        if ($mode !== 'demo') { $_SESSION = []; session_destroy(); setcookie(session_name(), '', ['expires'=>time()-3600, 'path'=>session_get_cookie_params()['path'], 'httponly'=>true, 'secure'=>session_get_cookie_params()['secure'], 'samesite'=>'Strict']); }
        json_response(200, ['ok'=>true]);
    }
    // Release the PHP session lock before acquiring any store locks.
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $definitions = require __DIR__ . '/private/domains.php';
    if ($route === '/meta' && $method === 'GET') json_response(200, $definitions);
    $initial = $mode === 'demo' ? require __DIR__ . '/private/seed.php' : array_fill_keys(array_keys($definitions), []);
    $file = storage_root() . '/' . $mode . '/records.json';
    if ($route === '/data' && $method === 'GET') {
        $result = with_json($file, $initial, function(&$data) use($definitions) { $result=[]; foreach ($definitions as $key=>$_) $result[$key]=active_rows($data,$key); return $result; });
        json_response(200, $result);
    }
    if (!preg_match('~^/entities/([a-z]+)(?:/([a-zA-Z0-9-]+))?$~D', $route, $match)) json_response(404, ['error'=>'Ruta no encontrada.']);
    $entity = $match[1]; $id = $match[2] ?? null;
    definition($definitions, $entity);
    if ($method === 'GET' && $id === null) json_response(200, with_json($file, $initial, fn(&$data) => active_rows($data, $entity)));
    if (!can_write($user['role'], $entity)) json_response(403, ['error'=>'Tu perfil no permite modificar este módulo.']);
    if (!(($method === 'POST' && $id === null) || ($method === 'PUT' && $id !== null) || ($method === 'DELETE' && $id !== null))) json_response(405, ['error'=>'Método no permitido.']);
    $input = $method === 'DELETE' ? [] : read_body();
    $result = with_json($file, $initial, function(&$data) use($definitions,$entity,$id,$input,$method) {
        if ($method === 'DELETE') { remove_record($data, $definitions, $entity, $id, 'restrict_business_delete'); return ['ok'=>true]; }
        return save_record($data, $definitions, $entity, $input, $id, 'validate_business');
    });
    $audit = json_encode(['at'=>gmdate('c'), 'actor'=>$user['username'], 'action'=>$method, 'entity'=>$entity, 'id'=>$id ?? $result['id']], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";
    if (file_put_contents(storage_root() . '/' . $mode . '/audit.jsonl', $audit, FILE_APPEND | LOCK_EX) === false) error_log('SIGEIA: no se pudo escribir auditoría.');
    json_response($method === 'POST' ? 201 : 200, $result);
} catch (DomainError $error) { json_response(400, ['error'=>$error->getMessage()]); }
catch (Throwable $error) { error_log('SIGEIA: ' . $error->getMessage()); json_response(500, ['error'=>'No se pudo completar la operación. Revisa PHP y los permisos del almacenamiento privado.']); }
