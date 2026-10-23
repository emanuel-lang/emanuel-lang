# Fichas de dominio — propuestas de piloto

Estado: **PENDIENTES DE REVISIÓN Y APROBACIÓN**. No existe aprobación registrada ni tablas SQL creadas. Estas fichas documentan el comportamiento implementado; no sustituyen las decisiones del responsable de negocio.

Campos comunes: `id` técnico, `createdAt`, `updatedAt`, `deletedAt` cuando se archiva. Referencias solo a registros activos. No hay restauración ni supresión definitiva en la interfaz. Las regiones y territorios tienen clave única entre registros activos.

## Regiones

Dominio: Territorial. Entidad: `regions`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Clave (`code`) | text | Sí | Texto, hasta 500 caracteres |

Borrado: lógico, rechazado si hay dependencias activas.

## Territorios

Dominio: Territorial. Entidad: `territories`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Clave (`code`) | text | Sí | Texto, hasta 500 caracteres |
| Región (`regionId`) | reference | Sí | Referencia a regions |
| Polígono (`polygon`) | polygon | No | Vacío o 3–2000 coordenadas WGS84; sin validación topológica |

Borrado: lógico, rechazado si hay dependencias activas.

## Localidades

Dominio: Territorial. Entidad: `localities`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Territorio (`territoryId`) | reference | Sí | Referencia a territories |

Borrado: lógico, rechazado si hay dependencias activas.

## Sectores

Dominio: Territorial. Entidad: `sectors`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Localidad (`localityId`) | reference | Sí | Referencia a localities |

Borrado: lógico, rechazado si hay dependencias activas.

## Operadores

Dominio: Operativo. Entidad: `operators`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Rol operativo (`roleId`) | reference | Sí | Referencia a roles |

Borrado: lógico, rechazado si hay dependencias activas.

## Roles

Dominio: Operativo. Entidad: `roles`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Descripción (`description`) | text | No | Texto, hasta 500 caracteres |

Borrado: lógico, rechazado si hay dependencias activas.

## Asignaciones

Dominio: Operativo. Entidad: `assignments`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Operador (`operatorId`) | reference | Sí | Referencia a operators |
| Nivel (`level`) | select | Sí | Región, Territorio, Localidad, Sector |
| Unidad territorial (`targetId`) | text | Sí | Texto, hasta 500 caracteres |

Borrado: lógico, rechazado si hay dependencias activas.

## Casas

Dominio: Electoral. Entidad: `houses`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Identificador (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Dirección (`address`) | text | Sí | Texto, hasta 500 caracteres |
| Sector (`sectorId`) | reference | Sí | Referencia a sectors |
| Estado de visita (`status`) | select | Sí | Pendiente, Visitada |
| Latitud (`lat`) | number | Sí | -90 a 90 |
| Longitud (`lng`) | number | Sí | -180 a 180 |

Borrado: lógico, rechazado si hay dependencias activas.

## Ciudadanos

Dominio: Electoral. Entidad: `citizens`.

| Campo | Tipo | Obligatorio | Relación / validación |
| --- | --- | --- | --- |
| Nombre (`name`) | text | Sí | Texto, hasta 500 caracteres |
| Casa (`houseId`) | reference | Sí | Referencia a houses |
| Estado de registro (`status`) | select | Sí | Por verificar, Verificado |

Borrado: lógico, rechazado si hay dependencias activas.

## Reglas pendientes de aprobación

- Jerarquía: región → territorio → localidad → sector → casa → ciudadano.
- Asignación: operador y destino existente del nivel elegido; no repetir la misma asignación activa.
- Estados de casa: Pendiente / Visitada. Estados de ciudadano: Por verificar / Verificado. Se modifican manualmente; no hay evidencia documental ni reglas externas de verificación.
- Clasificación: nombres de ciudadanos, direcciones y coordenadas de casas son datos personales o permiten identificación indirecta; no publicar ni compartir sin una base autorizada.
- Retención, aviso de privacidad, origen de datos, calidad, deduplicación, supresión definitiva, límites oficiales, reglas por cargo y permisos por territorio: por definir con responsables antes de cargar datos reales.
- No se solicita identificación oficial, afiliación, preferencia política ni información sensible adicional.
