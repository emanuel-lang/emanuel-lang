# SIGEIA Platform

**¿Usas XAMPP? Descarga [SIGEIA-XAMPP.zip](distribution/SIGEIA-XAMPP.zip) y sigue [LEEME-XAMPP.md](LEEME-XAMPP.md). Esa distribución funciona con Apache + PHP, sin Node.js ni MySQL. No copies este repositorio completo a `htdocs`.**

**Para ejecutar la carpeta descargada en tu localhost, empieza por [LEEME-PRIMERO.md](LEEME-PRIMERO.md). Incluye arranque directo sin instalar dependencias, con la interfaz ya compilada.**

Primera implementación funcional basada en **SIGEIA PLATFORM 1.0**. Interfaz en español, framework declarativo independiente del negocio y servidor con persistencia local. Alcance: piloto de una sola instancia; no es una plataforma empresarial terminada ni un despliegue público.

## Ejecutar

Requiere Node.js 22 o superior y npm. Desde este repositorio:

```bash
npm ci
npm run build
npm test
```

### Explorar con datos ficticios

```bash
npm run demo
```

El servidor escucha en `127.0.0.1:3000`. La demostración permite modificar sus registros sin autenticación. **Nunca la expongas a Internet ni cargues datos reales en este modo.** Sus datos se guardan en `.data/demo/`.

### Piloto privado

Por defecto, `npm run dev` y `npm start` usan modo piloto: datos vacíos y autenticación obligatoria. Antes de entrar, crea una cuenta individual desde el servidor. La contraseña se recibe por entrada estándar; no se pasa como argumento ni se guarda en texto plano:

```bash
# Bash: escribe una contraseña de al menos 14 caracteres sin mostrarla.
read -rsp 'Contraseña inicial: ' sigeia_password
printf '\n'
printf '%s' "$sigeia_password" | npm run user:create -- miusuario admin
unset sigeia_password
npm run dev
```

Para iniciar el servidor con la compilación de producción:

```bash
npm run build
npm start
```

No hay cuentas ni contraseñas predeterminadas. La creación de usuarios requiere acceso al servidor. Los perfiles admitidos son `admin`, `coordinador`, `capturista` y `consulta`. Se puede revocar una cuenta retirándola de `users.json` con el servicio detenido y un respaldo previo; la eliminación invalida sus sesiones en la siguiente petición. No hay todavía interfaz para administrar cuentas, MFA, recuperación ni cambio de contraseñas. No existe autorregistro público.

## Funciones implementadas

- Dashboard e indicadores actualizados cada 30 segundos, filtro por territorio y exportación CSV de agregados sin nombres ni direcciones de ciudadanos.
- Alta, edición, búsqueda y archivo mediante borrado lógico de regiones, territorios, localidades, sectores, roles operativos, operadores, asignaciones, casas y ciudadanos.
- Validación de referencias, claves de región/territorio únicas y protección de dependencias al archivar.
- Asignaciones por región, territorio, localidad o sector. No conceden acceso informático.
- Leaflet con polígonos editables por dibujo, deshacer puntos, cancelar, guardar y marcadores de casas. Coordenadas WGS84 en orden `[latitud, longitud]`.
- Registro de visitas y verificación de ciudadanos. No se recaban identificación oficial, contactos, afiliaciones ni preferencias políticas.
- Perfiles de acceso, cookies HttpOnly/SameSite, token CSRF, límite de intentos de acceso y contraseñas con scrypt y sal aleatoria. Sesiones en memoria con duración máxima de 8 horas, invalidadas al reiniciar el proceso.
- Bitácora local de operaciones: actor, fecha, operación, entidad e ID; no incluye nombres ni direcciones. Es un registro básico, no inmutable ni una auditoría regulatoria. Un fallo de escritura se avisa en el servidor, pero no revierte una operación ya persistida.
- Fichas de dominio propuestas visibles en la interfaz y documentadas en `docs/`.

### Fórmulas

**Cobertura de visitas = casas activas marcadas Visitada / casas activas registradas × 100**, redondeada al entero. Sin casas registradas se muestra 0%, no una estimación. El filtro sigue la relación casa → sector → localidad → territorio. El recuento de operadores en el dashboard es del equipo completo y está etiquetado como tal. Los indicadores no miden población total, cobertura geográfica, participación electoral ni apoyo político. No se muestran tendencias inventadas.

## Perfiles de acceso

| Perfil | Lectura | Escritura |
| --- | --- | --- |
| Administración | Todos los módulos | Todos los módulos |
| Coordinación | Todos los módulos | Todos excepto catálogo de roles operativos |
| Captura | Todos los módulos | Casas y ciudadanos |
| Consulta | Todos los módulos | Ninguna |

**No hay aislamiento por región, territorio o asignación:** cada cuenta autorizada puede leer todos los registros del piloto. Si el piloto exige acceso territorial o restricción de datos personales por equipo, implementa esa autorización antes de usar datos reales. Los roles operativos del catálogo y estos perfiles de acceso son conceptos diferentes.

## Datos, red y operación

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `SIGEIA_MODE` | `pilot` | `pilot` o `demo`; almacenes separados |
| `SIGEIA_DATA_DIR` | `.data/<modo>` | Directorio absoluto recomendado; **fuera de `dist/` y de cualquier raíz publicada** |
| `HOST` | `127.0.0.1` | Mantener privado detrás del proxy |
| `PORT` | `3000` | Puerto del servidor |
| `SIGEIA_SECURE_COOKIE` | desactivado para HTTP local | Establecer `true` cuando el acceso sea por HTTPS |
| `NODE_ENV` | desarrollo | `production` sirve exclusivamente `dist/` y habilita CSP |

Si personalizas `SIGEIA_DATA_DIR`, usa la misma variable al crear cuentas y arrancar el servidor. Las carpetas de datos no se versionan. El almacenamiento es JSON con reemplazo atómico por archivo y validación en servidor, apto para evaluar un piloto pequeño con **un único proceso escritor**. No ejecutes varias réplicas sobre ese directorio. No incluye transacciones entre archivos, cifrado en reposo, consultas espaciales ni mecanismos de alta disponibilidad. Para ampliar el uso, aprobar fichas y migrar a PostgreSQL/PostGIS será un trabajo separado.

El mapa vectorial y los puntos funcionan sin servicios externos. En modo piloto, las teselas de OpenStreetMap están **desactivadas** y solo se cargan después de una confirmación en la interfaz: el proveedor recibe IP y zona geográfica consultada. La demostración usa este mapa base automáticamente; si no hay red, permanecen los polígonos y puntos sobre la cuadrícula. No hay geocodificación ni envío de registros personales a terceros. Uso de teselas sujeto a la [política de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/); un despliegue de mayor escala requiere un proveedor adecuado o un servidor propio. No hay API de IA ni credenciales externas requeridas.

### Antes de incorporar personas y datos reales

1. Revisar/aprobar fichas y reglas con responsables de dominio; definir ámbito, finalidad, autorización para tratar datos, aviso de privacidad, plazos de conservación, atención de derechos y proceso de supresión definitiva. El archivo lógico no equivale a una supresión definitiva.
2. Determinar si la lectura global por todos los perfiles es aceptable. Si no lo es, completar permisos por ámbito antes del piloto.
3. Desplegar el build detrás de HTTPS en un entorno privado, usar `NODE_ENV=production`, `SIGEIA_MODE=pilot` y `SIGEIA_SECURE_COOKIE=true`. El proxy debe conservar `Host`/`Origin`, limitar solicitudes y redirigir HTTP a HTTPS. No usar Vite ni modo demo como servidor público.
4. Crear cuentas individuales y comprobar cada perfil con los responsables. Aplicar controles de acceso al host y cifrado del volumen/backups.
5. Definir respaldos y probar restauración antes de la primera carga. Con el servidor detenido, copiar **todo** `.data/pilot/` (registros, hashes de usuarios y bitácora) a almacenamiento privado cifrado. Restaurar con el proceso detenido, permisos restrictivos y reiniciar; verificar salud, acceso e indicadores. Las sesiones previas no se restauran. No subir estos archivos a Git.
6. Definir responsables de operación, monitoreo y respuesta a incidentes; realizar una revisión de seguridad y privacidad para el contexto real. Estas tareas no se han realizado ni sustituido por las pruebas automáticas.

## Validación

```bash
npm test
npm run build
npm run test:browser
npm audit
```

Las pruebas de API crean almacenes temporales y verifican independencia del framework, relaciones, validaciones, archivo, persistencia, autenticación, CSRF y permisos. Las pruebas de navegador usan Chromium instalado en `/usr/bin/chromium` (personalizable con `CHROMIUM_PATH`), levantan sus propios servidores y usan solo datos sintéticos: dashboard, alta/edición/búsqueda/archivo, dibujo de polígono, CSV, ancho móvil y sesiones del piloto. No verifican disponibilidad de terceros ni publicación.

Salud del proceso: `GET /api/health` devuelve `status: ok` y el modo. No implica aprobación del piloto. No se ha publicado ni desplegado esta aplicación a un servicio externo.

## Arquitectura y pendientes

Consulta [arquitectura y decisiones](docs/ARQUITECTURA.md) y [fichas propuestas](docs/FICHAS-DOMINIO.md). IA, mapas/capas avanzadas, cobertura geográfica con PostGIS, permisos territoriales, importación masiva, reportes configurables, administración completa de cuentas y operación de múltiples instancias quedan pendientes. No se simulan como funcionalidades existentes.
