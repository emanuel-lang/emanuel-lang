# SIGEIA para XAMPP · Apache + PHP

Esta distribución ejecuta la plataforma en PHP. **No necesita Node.js ni MySQL para funcionar**. Incluye interfaz compilada, demostración con registros ficticios y piloto privado vacío con cuenta propia. No abras los archivos PHP con doble clic ni uses el ZIP anterior para Node.js.

## Instalar en Windows

1. Instala XAMPP con **PHP 8.1 o superior** (recomendado: XAMPP con PHP 8.2).
2. Descarga `SIGEIA-XAMPP.zip` desde `distribution/` en GitHub y descomprímelo. Dentro hay una carpeta llamada **sigeia**.
3. Copia esa carpeta directamente dentro de **`C:\xampp\htdocs\`**. Debe quedar **`C:\xampp\htdocs\sigeia\index.php`**, sin una carpeta adicional intermedia.
4. Abre el panel de XAMPP y pulsa **Start en Apache**. No es necesario iniciar MySQL.
5. Abre **http://localhost/sigeia/** en el navegador.

La página inicial muestra la demostración sin contraseña. Incluye regiones, territorios, sectores, operadores, casas y ciudadanos ficticios. Todos los cambios se guardan localmente. Puedes registrar, editar, archivar, dibujar polígonos y exportar indicadores.

Si Apache utiliza otro puerto, por ejemplo 8080, abre **http://localhost:8080/sigeia/**. En macOS/Linux usa la carpeta `htdocs` de tu instalación de XAMPP (por ejemplo `/Applications/XAMPP/xamppfiles/htdocs/` o `/opt/lampp/htdocs/`).

## Piloto privado y primera cuenta

1. Abre **http://localhost/sigeia/configurar.php** (ajusta el puerto si es necesario).
2. Elige un usuario y una contraseña propia de entre **14 y 72 bytes**. Para una contraseña ASCII, cada carácter cuenta como un byte. Confírmala y crea tu cuenta.
3. Serás dirigido al inicio de sesión del piloto en **http://localhost/sigeia/index.php?mode=pilot**.

El piloto tiene datos vacíos y no copia la demostración. **No hay contraseñas predeterminadas.** La creación inicial solo se permite desde el mismo equipo (`127.0.0.1` o `::1`) y se cierra al crear la primera cuenta. La demostración también está limitada a localhost. No hay todavía una interfaz PHP para administrar cuentas adicionales o recuperar contraseñas. Las cuentas Node.js no se importan ni comparten contraseñas con PHP.

Para abrir el piloto por defecto, edita `config.php` y cambia `'default_mode' => 'demo'` por `'default_mode' => 'pilot'`. El enlace `index.php?mode=demo` sigue siendo únicamente una demostración local con su propio almacén.

## Datos y permisos

Los datos **NO se guardan dentro de `htdocs`**. La aplicación crea una carpeta privada por instalación, por ejemplo:

```text
C:\xampp\sigeia-data\<identificador-de-instalación>\
    users.json
    attempts.json
    sessions\
    demo\records.json
    demo\audit.jsonl
    pilot\records.json
    pilot\audit.jsonl
```

Apache debe poder crear/escribir esta carpeta. En Windows, tu instalación habitual de XAMPP suele disponer de ese acceso. En macOS/Linux, concede acceso únicamente al usuario de Apache sobre esa carpeta privada. **No uses permisos 777 ni muevas los registros a `htdocs`.** Si necesitas otra ubicación, establece una ruta absoluta fuera de cualquier raíz web en `storage_dir` de `config.php`. La aplicación rechaza ubicaciones dentro de su `DOCUMENT_ROOT`.

El identificador depende de la ubicación de instalación: no renombres/muevas la carpeta después de cargar registros sin planificar la migración del almacenamiento. Antes de actualizar, detén Apache y respalda **toda** la carpeta privada: registros, usuarios y bitácoras. Para conservar datos al cambiar de ubicación, configura explícitamente el mismo `storage_dir` privado. **No mezcles almacenes PHP con los de la versión Node.js**: usan formatos de contraseña diferentes.

## Verificar que funciona

- Abrir la demostración: deben aparecer tres territorios, tres operadores y los indicadores calculados a partir de los datos ficticios iniciales.
- Crear un territorio y dibujarle un polígono desde «Mapa territorial»; guardar, recargar y comprobar que se conserva.
- Registrar y modificar una casa o ciudadano ficticio. El archivo de un registro con dependencias activas debe rechazarse.
- Crear la primera cuenta del piloto, iniciar sesión, recargar y cerrar sesión. El piloto empieza con cero registros.
- El endpoint `api.php?route=%2Fhealth` informa del arranque de PHP; no equivale a validar privacidad, permisos de negocio o aceptación del piloto.

El mapa base OpenStreetMap requiere conexión a Internet. Si no carga, siguen funcionando la cuadrícula, los polígonos y las casas. En el piloto, las teselas externas requieren confirmación antes de cargarse.

## Solución de problemas

- **404:** comprueba `htdocs\sigeia\index.php` y el puerto de Apache. Prueba explícitamente `http://localhost/sigeia/index.php`. No hace falta `mod_rewrite`.
- **Código PHP visible o descarga de index.php:** Apache no está ejecutando PHP. Usa Apache de XAMPP y no un servidor de archivos estáticos. No publiques la carpeta mientras PHP no esté configurado.
- **Error 500 al abrir o crear cuenta:** revisa el registro de errores de Apache desde el panel de XAMPP. Verifica PHP >=8.1 y permisos para crear `sigeia-data` fuera de `htdocs`. No se muestran contraseñas ni rutas privadas en las respuestas de la API.
- **Puerto 80 ocupado:** cambia el puerto de Apache siguiendo su configuración y utiliza ese puerto en la dirección del navegador.
- **No puede cargar JS/CSS:** extrae toda la carpeta, incluyendo `assets/` y `app.html`. Las rutas son relativas, así que también puedes usar otro nombre de carpeta.
- **Configurar indica que ya hay cuenta:** la instalación inicial está cerrada; utiliza la cuenta que creaste. No borres archivos de usuarios para resolverlo sin un respaldo y un procedimiento de recuperación.

## Alcance

Backend PHP nativo con sesiones HttpOnly/SameSite, token CSRF, contraseñas `password_hash`/`password_verify`, límite de intentos de acceso, validación en servidor, archivos JSON protegidos con bloqueos y borrado lógico. El núcleo PHP recibe metadatos y validaciones de negocio inyectadas. No requiere extensiones mbstring, cURL ni una base de datos; usa funciones estándar de PHP 8.1+ y sesiones.

Los perfiles del piloto pueden leer todos los territorios; no hay aislamiento de lectura territorial. No incluye IA, importación masiva, topología espacial ni operación empresarial completa. No expongas la demostración a Internet. Para usar datos reales con otras personas siguen siendo necesarios HTTPS, revisión de privacidad, aprobación de fichas, cuentas individuales y respaldos. Esta entrega sirve para visualizar y evaluar localmente en XAMPP; no significa que se haya probado tu instalación concreta de Windows.

## Para desarrolladores

El código PHP está en `xampp/`. Las definiciones y datos sintéticos se generan desde `server/domains.js` y `server/seed.js`, evitando mantener dos catálogos distintos. Desde el código fuente completo:

```sh
npm ci
npm run build:xampp
```

La salida queda en `build-xampp/sigeia/`; solo esa carpeta se copia a `htdocs`. No copies todo el repositorio de desarrollo a una carpeta web. El backend Node.js original sigue disponible para desarrollo y otras formas de ejecución.
