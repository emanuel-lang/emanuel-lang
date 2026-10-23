import { addUser } from './auth.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const [username, role = 'consulta'] = process.argv.slice(2);
let password = '';
if (process.stdin.isTTY) {
  const silent = new Writable({ write(chunk, encoding, done) { done(); } });
  const reader = createInterface({ input: process.stdin, output: silent, terminal: true });
  try {
    process.stdout.write('Contraseña (mínimo 14 caracteres, entrada oculta): ');
    password = await reader.question('');
    process.stdout.write('\nRepite la contraseña: ');
    const confirmation = await reader.question('');
    process.stdout.write('\n');
    if (password !== confirmation) { console.error('Las contraseñas no coinciden.'); process.exit(1); }
  } finally { reader.close(); }
} else {
  for await (const chunk of process.stdin) password += chunk;
}
try {
  addUser(resolve(process.env.SIGEIA_DATA_DIR || '.data/' + (process.env.SIGEIA_MODE || 'pilot'), 'users.json'), username || '', password.replace(/\r?\n$/, ''), role);
  console.log(`Cuenta creada: ${username} (${role}).`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
