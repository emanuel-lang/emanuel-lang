# Arquitectura y decisiones del piloto

Fuente: documento proporcionado por el usuario, «SIGEIA PLATFORM», versión 1.0, estado DOMAIN FREEZE. Esta implementación interpreta objetivos funcionales sin atribuir aprobación a nuevas definiciones de dominio.

## Dependencias

```text
Interfaz → API HTTP → Store genérico
                  ↗ definiciones + validaciones de negocio inyectadas
```

- `server/framework.js` solo conoce definiciones declarativas, tipos de campo, referencias, persistencia y archivo. No importa módulos de negocio. Una prueba lo usa con un catálogo ajeno a SIGEIA.
- `server/domains.js` define entidades y relaciones; inyecta validaciones y restricciones de archivo específicas del negocio.
- `server/index.js` compone módulos, autorización, API y entrega de archivos. `server/auth.js` administra cuentas de acceso, distintas de los operadores registrados.
- `src/main.js` genera formularios y tablas a partir de `/api/meta`. Dashboard, cálculo de indicadores y mapa son adaptadores específicos de SIGEIA sobre esa base. No se afirma que toda la interfaz sea independiente del negocio.
- `src/style.css` contiene el diseño adaptable sin fuentes externas. Leaflet, Lucide y Vite están sujetos a sus respectivas licencias.

## Registro de decisiones

### ADR-001 · Framework declarativo pequeño

El core recibe definiciones y validaciones, sin dependencias del dominio. Se evita generar un framework empresarial abstracto antes de validar flujos reales. La aprobación de fichas no está automatizada: las actuales son propuestas.

### ADR-002 · Persistencia JSON provisional

El documento requiere fichas aprobadas antes de crear tablas. No hay aprobación registrada, por lo que no se crean tablas SQL. Se usan archivos JSON en un directorio privado, con borrado lógico, referencias verificadas y reemplazo atómico del archivo de registros. El archivo inicial del piloto está vacío. Esta decisión no resuelve la aprobación funcional ni sustituye una base de datos para operación de mayor escala.

Límite: un proceso escritor, dataset pequeño. Sin transacción conjunta de datos/bitácora, índices espaciales, cifrado propio ni recuperación ante desastre automatizada. La siguiente etapa necesita aprobación de fichas y evaluación de PostgreSQL/PostGIS y migraciones.

### ADR-003 · Identidades separadas

Operadores/roles/asignaciones modelan la operación; cuentas/perfiles autorizan acceso. Crear un operador no crea una cuenta. Los perfiles se aplican en API, no solo ocultando botones. Acceso de lectura global para el piloto; no se infiere autorización desde la asignación territorial. Ese aislamiento debe añadirse si es necesario para el ámbito real.

### ADR-004 · Métricas observables

Solo se muestran agregados de registros activos. Cobertura de visitas sobre casas registradas, no cobertura física, geográfica o electoral. No se generan porcentajes de crecimiento ni tendencias sin historia suficiente. Actualización por consulta cada 30 segundos; no hay canal push ni garantía de latencia estricta.

### ADR-005 · Geoespacial sin extracción externa de datos

Leaflet gestiona polígonos y puntos. Se almacenan coordenadas `[latitud, longitud]` WGS84; no GeoJSON formal ni límites oficiales. Validación básica de coordenadas y número de vértices; no incluye análisis topológico ni comprobación de autointersecciones. El mapa base externo es optativo y se informa al usuario del flujo de IP/área consultada. No se cargan teselas externas automáticamente en piloto.

### ADR-006 · IA fuera de esta primera entrega

El dominio analítico queda preparado conceptualmente para una integración posterior. No hay agente, modelo ni inferencias habilitadas; se requiere definir casos de uso, datos permitidos, evaluación y controles antes de incorporar IA. No se calculan afinidades políticas ni se automatiza persuasión.

### ADR-007 · Separación demostración/piloto

Demostración explícita sin autenticación con datos sintéticos; piloto por defecto vacío y autenticado. Directorios distintos. Pruebas ejecutadas con almacenamiento temporal para no modificar registros del usuario. Nunca reutilizar una demostración como un piloto con datos reales.

### ADR-008 · Distribución PHP nativa para XAMPP

Se añade un adaptador HTTP/PHP en `xampp/` para ejecutar SIGEIA con Apache y PHP 8.1+, sin proceso Node.js ni MySQL. La interfaz usa rutas relativas y un endpoint inyectado mediante una etiqueta meta, de modo que funciona en subcarpetas sin `mod_rewrite`. Los catálogos declarativos y los datos sintéticos se generan desde las mismas definiciones JavaScript; el núcleo PHP recibe definiciones y validaciones de negocio inyectadas.

Almacenamiento PHP por instalación fuera de DocumentRoot, reemplazo por archivo y bloqueo estable con `flock` para no perder escrituras concurrentes de procesos Apache. Las cuentas y sesiones PHP son independientes de Node.js; usan `password_hash`/`password_verify` y no importan sus hashes. El asistente inicial se limita a localhost, usa CSRF y deja de crear cuentas al existir la primera. Demostración restringida a localhost; piloto vacío independiente. No se afirma equivalencia operativa entre instalaciones ni se habilita lectura por territorio.

Validación sobre Apache/PHP reales en Linux y navegador Chromium; no se ha ejecutado el instalador de XAMPP para Windows en este entorno. La entrega incluye una carpeta `sigeia` compilada dentro de un ZIP. Mantener PHP actualizado y revisar las reglas y los controles de operación antes de usar datos reales.
