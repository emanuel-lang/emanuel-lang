<?php
declare(strict_types=1);
if (!defined('SIGEIA_APP')) { http_response_code(403); exit; }
const LEVELS = ['Región'=>'regions', 'Territorio'=>'territories', 'Localidad'=>'localities', 'Sector'=>'sectors'];
function json_response(int $status, mixed $value): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function local_request(): bool { return in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true); }
function normalized_path(string $value): string { return strtolower(str_replace('\\', '/', rtrim($value, '/\\'))); }
function storage_root(): string {
    static $root;
    if ($root !== null) return $root;
    $config = require dirname(__DIR__) . '/config.php';
    $docroot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
    if ($docroot === false || $docroot === '') throw new RuntimeException('DOCUMENT_ROOT no disponible.');
    $candidate = getenv('SIGEIA_XAMPP_DATA_DIR') ?: ($config['storage_dir'] ?: dirname($docroot) . '/sigeia-data/' . substr(hash('sha256', __DIR__), 0, 12));
    if (!is_dir($candidate) && !mkdir($candidate, 0700, true) && !is_dir($candidate)) throw new RuntimeException('No se pudo crear almacenamiento privado.');
    $resolved = realpath($candidate);
    if (!$resolved || normalized_path($resolved) === normalized_path($docroot) || str_starts_with(normalized_path($resolved) . '/', normalized_path($docroot) . '/')) throw new RuntimeException('El almacenamiento debe estar fuera de htdocs.');
    return $root = $resolved;
}
function with_json(string $file, mixed $initial, callable $callback): mixed {
    if (!is_dir(dirname($file)) && !mkdir(dirname($file), 0700, true) && !is_dir(dirname($file))) throw new RuntimeException('Directorio no disponible.');
    $lock = fopen($file . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('No se pudo bloquear almacenamiento.');
    $temp = null;
    try {
        $value = is_file($file) ? json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR) : $initial;
        $result = $callback($value);
        $temp = $file . '.' . bin2hex(random_bytes(8)) . '.tmp';
        if (file_put_contents($temp, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('No se pudo guardar.');
        chmod($temp, 0600);
        if (!rename($temp, $file)) throw new RuntimeException('No se pudo reemplazar almacenamiento.');
        return $result;
    } finally {
        if ($temp !== null && is_file($temp)) unlink($temp);
        flock($lock, LOCK_UN); fclose($lock);
    }
}
function users(): array { return with_json(storage_root() . '/users.json', [], fn(&$value) => $value); }
function session_init(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $directory = storage_root() . '/sessions';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('No se pudo preparar sesiones.');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_save_path($directory);
    session_name('sigeia_' . substr(hash('sha256', __DIR__), 0, 10));
    $base = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    session_set_cookie_params(['lifetime'=>8*3600, 'path'=>rtrim($base, '/') . '/', 'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'httponly'=>true, 'samesite'=>'Strict']);
    if (!session_start()) throw new RuntimeException('No se pudo iniciar sesión.');
}
function active_user(): ?array {
    session_init();
    if (empty($_SESSION['username']) || ($_SESSION['expires'] ?? 0) < time()) return null;
    foreach (users() as $user) if ($user['username'] === $_SESSION['username']) return ['username'=>$user['username'], 'role'=>$user['role'], 'csrf'=>$_SESSION['csrf'], 'expires'=>$_SESSION['expires']*1000];
    return null;
}
function begin_login(array $user): array {
    session_regenerate_id(true);
    $_SESSION = ['username'=>$user['username'], 'csrf'=>bin2hex(random_bytes(24)), 'expires'=>time()+8*3600];
    return ['username'=>$user['username'], 'role'=>$user['role'], 'csrf'=>$_SESSION['csrf'], 'expires'=>$_SESSION['expires']*1000];
}
function can_write(string $role, string $entity): bool {
    return $role === 'admin' || ($role === 'coordinador' && $entity !== 'roles') || ($role === 'capturista' && in_array($entity, ['houses', 'citizens'], true));
}
function require_same_origin(): void {
    if (empty($_SERVER['HTTP_ORIGIN'])) return;
    $origin = parse_url($_SERVER['HTTP_ORIGIN']);
    $host = strtolower(($origin['host'] ?? '') . (isset($origin['port']) ? ':'.$origin['port'] : ''));
    if ($host !== strtolower($_SERVER['HTTP_HOST'] ?? '')) json_response(403, ['error'=>'Origen no permitido.']);
}
function read_body(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 200000) json_response(413, ['error'=>'Solicitud demasiado grande.']);
    $raw = file_get_contents('php://input', false, null, 0, 200001);
    if ($raw === false || strlen($raw) > 200000) json_response(413, ['error'=>'Solicitud demasiado grande.']);
    try {
        $value = json_decode($raw ?: '{}', false, 512, JSON_THROW_ON_ERROR);
        if (!is_object($value)) throw new RuntimeException();
        return json_decode($raw ?: '{}', true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) { json_response(400, ['error'=>'JSON inválido.']); }
}
function mode(): string {
    $config = require dirname(__DIR__) . '/config.php';
    $mode = $_GET['mode'] ?? $config['default_mode'];
    if (!is_string($mode) || !in_array($mode, ['demo', 'pilot'], true)) json_response(400, ['error'=>'Modo inválido.']);
    if ($mode === 'demo' && !local_request()) json_response(403, ['error'=>'La demostración solo está disponible desde localhost.']);
    return $mode;
}
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
