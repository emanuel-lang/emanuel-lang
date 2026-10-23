import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const args = process.argv.slice(2);
process.env.NODE_ENV = args.includes('--dev') ? 'development' : 'production';
if (args.includes('--demo')) process.env.SIGEIA_MODE = 'demo';
const { createApp } = await import('../server/index.js');
try {
  const { server } = await createApp();
  const port = Number(process.env.PORT || 3000);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cierra la otra instancia de SIGEIA o cambia PORT.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`\nSIGEIA · ${process.env.SIGEIA_MODE === 'demo' ? 'DEMOSTRACIÓN CON DATOS FICTICIOS' : 'PILOTO PRIVADO'}`);
    console.log(`Abre en tu navegador: http://localhost:${port}`);
    console.log('Mantén esta ventana abierta. Para detener: Ctrl+C.\n');
  });
} catch (error) { console.error('No se pudo iniciar SIGEIA:', error.message); process.exitCode = 1; }
