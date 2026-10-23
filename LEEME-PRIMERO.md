# SIGEIA · Inicio en tu localhost

## Lo necesario

Instala **Node.js 22 o superior** desde https://nodejs.org (versión LTS). No necesitas XAMPP, Apache, PHP, MySQL ni una cuenta en la nube. Descomprime **toda** la carpeta antes de ejecutar archivos. No abras `index.html` con doble clic: la aplicación necesita su servidor.

## Ver la plataforma con datos de ejemplo

La carpeta incluye la interfaz ya compilada. **Para verla funcionar no necesitas instalar dependencias ni ejecutar npm install.**

- **Windows:** haz doble clic en `INICIAR-DEMO.cmd`.
- **macOS / Linux:** abre una terminal dentro de esta carpeta y ejecuta `sh iniciar-demo.sh`.
- **Cualquier sistema:** desde la carpeta, ejecuta `node scripts/start.mjs --demo`.

Abre **http://localhost:3000** en tu navegador. No pide contraseña en demostración. Mantén abierta la terminal; para detener usa `Ctrl+C`. Si el sistema pregunta por acceso de red, el funcionamiento local no requiere abrirlo a redes públicas.

Puedes crear y editar registros, dibujar polígonos en «Mapa territorial», registrar casas y ciudadanos, asignar operadores y consultar indicadores. Usa el botón de ayuda de la parte superior para seguir el recorrido sugerido. La demostración crea únicamente datos ficticios. El mapa base externo necesita Internet; sin él funcionan la cuadrícula, los polígonos y los puntos.

## Probar el acceso privado

Detén primero la demostración. Abre una terminal en esta carpeta y crea tu cuenta:

```sh
node server/create-user.js administrador admin
```

Escribe y confirma tu contraseña (14–256 caracteres). No se muestra mientras escribes. Después ejecuta:

```sh
node scripts/start.mjs
```

También puedes usar `INICIAR-PILOTO.cmd` en Windows o `sh iniciar-piloto.sh` en macOS/Linux. Abre http://localhost:3000 e ingresa con tu usuario y contraseña. El piloto empieza vacío; los datos de demostración se guardan por separado. No hay contraseñas predeterminadas.

Para crear otras cuentas usa el mismo comando, cambiando nombre y perfil: `admin`, `coordinador`, `capturista` o `consulta`. Los perfiles actuales pueden leer todos los territorios; la escritura cambia según el perfil.

## Dónde se guardan tus registros

Se conservan al cerrar y volver a iniciar: `.data/demo/` para demostración y `.data/pilot/` para piloto. La carpeta `.data` aparece después del primer arranque. No la publiques ni la compartas después de incorporar registros. Con la aplicación detenida, respalda la carpeta correspondiente en un lugar privado. El ZIP entregado no contiene cuentas, contraseñas, registros reales ni dependencias de tu sistema.

## Si quieres modificar el código

```sh
npm ci
npm run dev
```

Al terminar tus cambios, detén desarrollo y ejecuta:

```sh
npm run build
npm start
```

`npm test` ejecuta las pruebas de API. Para las de navegador: `npx playwright install chromium` y después `npm run test:browser`. También puedes definir `CHROMIUM_PATH` para usar otro Chromium instalado. Las pruebas de navegador se validaron en Linux; no se ejecutaron en Windows/macOS.

## Si no arranca

- **node no se reconoce:** instala Node.js y vuelve a abrir la terminal.
- **puerto 3000 ocupado:** cierra la instancia anterior. Para cambiarlo, en PowerShell ejecuta `$env:PORT=3001; node scripts/start.mjs --demo`; en macOS/Linux, `PORT=3001 node scripts/start.mjs --demo`. Abre el puerto elegido en el navegador.
- **no aparecen los cambios de código:** ejecuta `npm run build` y reinicia el servidor, o utiliza `npm run dev` tras instalar dependencias.
- **se cierra la ventana:** arranca desde una terminal para leer el error. Revisa que extrajiste todo el ZIP y que usas Node.js 22 o superior.

Es una primera versión funcional para evaluación local. No está desplegada públicamente. IA, aislamiento de lectura por territorio y base de datos para múltiples instancias quedan pendientes. Antes de usar datos reales con otras personas, revisa `README.md` y las fichas propuestas en `docs/`: HTTPS, privacidad, aprobación del dominio, cuentas individuales y respaldos necesitan configuración para el contexto del piloto.
