import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
export const profiles = ['admin', 'coordinador', 'capturista', 'consulta'];
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(':');
  const computed = hashPassword(password, salt).split(':')[1];
  return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(digest, 'hex'));
}
export function readUsers(file) { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []; }
export function addUser(file, username, password, role) {
  if (!/^[a-zA-Z0-9_.@-]{3,80}$/.test(username)) throw new Error('Usuario inválido (3–80 caracteres).');
  if (password.length < 14 || password.length > 256) throw new Error('La contraseña debe tener entre 14 y 256 caracteres.');
  if (!profiles.includes(role)) throw new Error('Perfil inválido.');
  const users = readUsers(file);
  if (users.some(x => x.username === username)) throw new Error('El usuario ya existe.');
  users.push({ username, role, passwordHash: hashPassword(password) });
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file + '.tmp', JSON.stringify(users, null, 2), { mode: 0o600 });
  renameSync(file + '.tmp', file);
}
export function canWrite(role, entity) {
  return role === 'admin' || (role === 'coordinador' && entity !== 'roles') || (role === 'capturista' && ['houses', 'citizens'].includes(entity));
}
export class Auth {
  constructor(file) { this.file = file; this.sessions = new Map(); this.attempts = new Map(); }
  login(username, password, ip) {
    const now = Date.now();
    const key = ip;
    const attempt = this.attempts.get(key);
    if (attempt && now - attempt.since < 15 * 60_000 && attempt.count >= 10) return { blocked: true };
    const user = readUsers(this.file).find(x => x.username === username);
    // Equalize the main password-hashing cost for unknown usernames.
    const fallback = '00000000000000000000000000000000:' + '00'.repeat(64);
    const valid = verifyPassword(password, user?.passwordHash || fallback);
    if (!user || !valid) {
      this.attempts.set(key, { since: attempt && now - attempt.since < 15 * 60_000 ? attempt.since : now, count: attempt && now - attempt.since < 15 * 60_000 ? attempt.count + 1 : 1 });
      return null;
    }
    this.attempts.delete(key);
    for (const [token, value] of this.sessions) if (value.expires < now) this.sessions.delete(token);
    const token = randomBytes(32).toString('hex');
    const session = { username: user.username, role: user.role, csrf: randomBytes(24).toString('hex'), expires: now + 8 * 3600_000 };
    this.sessions.set(token, session);
    return { token, session };
  }
  token(req) { return /(?:^|;\s*)sigeia_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
  get(req) {
    const token = this.token(req);
    const session = this.sessions.get(token);
    if (!session || session.expires < Date.now()) { this.sessions.delete(token); return null; }
    const user = readUsers(this.file).find(x => x.username === session.username);
    if (!user) { this.sessions.delete(token); return null; }
    return { ...session, role: user.role };
  }
  logout(req) { this.sessions.delete(this.token(req)); }
}
