import http from 'node:http';
import { resolve, join, extname, relative } from 'node:path';
import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Store, ValidationError } from './framework.js';
import { domains, validateBusiness, canDelete } from './domains.js';
import { seed } from './seed.js';
import { Auth, canWrite } from './auth.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function createApp(options = {}) {
  const mode = options.mode || process.env.SIGEIA_MODE || 'pilot';
  if (!['pilot', 'demo'].includes(mode)) throw new Error('SIGEIA_MODE debe ser pilot o demo.');
  const dataDir = resolve(options.dataDir || process.env.SIGEIA_DATA_DIR || join(root, '.data', mode));
  const empty = Object.fromEntries(Object.keys(domains).map(k => [k, []]));
  const store = new Store({ definitions: domains, file: join(dataDir, 'records.json'), seed: mode === 'demo' ? seed : empty, validate: validateBusiness, beforeDelete: canDelete });
  const auth = new Auth(join(dataDir, 'users.json'));
  const secure = options.secure ?? process.env.SIGEIA_SECURE_COOKIE === 'true';
  let vite;
  if (options.frontend !== false && process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    vite = await createServer({ root, server: { middlewareMode: true, fs: { strict: true, allow: [root], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**'] } }, appType: 'spa' });
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (process.env.NODE_ENV === 'production') res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    const cookie = (value, age) => `sigeia_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Método no permitido.' });
        if (vite) return vite.middlewares(req, res, () => json(404, { error: 'No encontrado.' }));
        const path = resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
        const dist = resolve(root, 'dist');
        if (relative(dist, path).startsWith('..')) return json(403, { error: 'Ruta inválida.' });
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
        let body;
        let actual = path;
        try { body = await readFile(path); } catch { actual = join(dist, 'index.html'); body = await readFile(actual); }
        res.writeHead(200, { 'Content-Type': types[extname(actual)] || 'application/octet-stream' }); return res.end(req.method === 'HEAD' ? undefined : body);
      }
      if (url.pathname === '/api/health') return json(200, { status: 'ok', mode });
      const mutating = !['GET', 'HEAD'].includes(req.method);
      if (mutating && !req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Se requiere application/json.' });
      if (mutating && req.headers.origin) {
        const origin = new URL(req.headers.origin);
        if (origin.host !== req.headers.host) return json(403, { error: 'Origen no permitido.' });
      }
      async function body() {
        let buffer = '';
        for await (const chunk of req) {
          buffer += chunk;
          if (Buffer.byteLength(buffer) > 200_000) throw new ValidationError('Solicitud demasiado grande.');
        }
        try {
          const value = JSON.parse(buffer || '{}');
          if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
          return value;
        } catch { throw new ValidationError('JSON inválido.'); }
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        if (mode === 'demo') return json(400, { error: 'La demostración no requiere inicio de sesión.' });
        const input = await body();
        if (typeof input.username !== 'string' || typeof input.password !== 'string' || input.username.length > 80 || input.password.length > 256) return json(400, { error: 'Credenciales inválidas.' });
        const result = auth.login(input.username, input.password, req.socket.remoteAddress);
        if (!result || result.blocked) return json(result?.blocked ? 429 : 401, { error: result?.blocked ? 'Demasiados intentos. Espera 15 minutos.' : 'Usuario o contraseña incorrectos.' });
        res.setHeader('Set-Cookie', cookie(result.token, 8 * 3600));
        return json(200, { ...result.session, mode });
      }
      const session = mode === 'demo' ? { username: 'Demostración', role: 'admin', csrf: 'demo' } : auth.get(req);
      if (!session) return json(401, { error: 'Inicia sesión para continuar.', mode });
      if (url.pathname === '/api/auth/me') return json(200, { ...session, mode });
      if (mutating && req.headers['x-csrf-token'] !== session.csrf) return json(403, { error: 'Sesión inválida. Actualiza la página.' });
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
        auth.logout(req); res.setHeader('Set-Cookie', cookie('', 0)); return json(200, { ok: true });
      }
      if (req.method === 'GET' && url.pathname === '/api/meta') return json(200, domains);
      if (req.method === 'GET' && url.pathname === '/api/data') return json(200, Object.fromEntries(Object.keys(domains).map(k => [k, store.list(k)])));
      const match = /^\/api\/entities\/([a-z]+)(?:\/([a-zA-Z0-9-]+))?$/.exec(url.pathname);
      if (!match) return json(404, { error: 'Ruta no encontrada.' });
      const [, entity, id] = match;
      store.definition(entity);
      if (req.method === 'GET' && !id) return json(200, store.list(entity));
      if (!canWrite(session.role, entity)) return json(403, { error: 'Tu perfil no permite modificar este módulo.' });
      let result;
      if (req.method === 'POST' && !id) result = store.save(entity, await body());
      else if (req.method === 'PUT' && id) result = store.save(entity, await body(), id);
      else if (req.method === 'DELETE' && id) { store.remove(entity, id); result = { ok: true }; }
      else return json(405, { error: 'Método no permitido.' });
      // No names, addresses or request bodies are written to the audit log.
      try { await appendFile(join(dataDir, 'audit.jsonl'), JSON.stringify({ at: new Date().toISOString(), actor: session.username, action: req.method, entity, id: id || result.id }) + '\n', { mode: 0o600 }); }
      catch { console.error('No se pudo escribir la auditoría; revisar almacenamiento.'); }
      return json(req.method === 'POST' ? 201 : 200, result);
    } catch (error) {
      if (!(error instanceof ValidationError)) console.error('Error interno:', error.code || error.name);
      if (!res.headersSent) json(error instanceof ValidationError ? 400 : 500, { error: error instanceof ValidationError ? error.message : 'Error interno. Revisa el almacenamiento y los registros del servidor.' });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.on('close', () => { void vite?.close(); });
  return { server, store, auth, dataDir };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = await createApp();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`SIGEIA disponible en puerto ${port} · modo ${process.env.SIGEIA_MODE || 'pilot'}`));
}
