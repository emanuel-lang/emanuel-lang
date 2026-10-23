// Domain definitions are consumed by the framework; the framework never imports this file.
const text = (key, label, required = true) => ({ key, label, type: 'text', required });
const ref = (key, label, entity, required = true) => ({ key, label, type: 'reference', entity, required });
const select = (key, label, options) => ({ key, label, type: 'select', options, required: true });
export const domains = {
  regions: { label: 'Regiones', singular: 'Región', domain: 'Territorial', fields: [text('name', 'Nombre'), text('code', 'Clave')] },
  territories: { label: 'Territorios', singular: 'Territorio', domain: 'Territorial', fields: [text('name', 'Nombre'), text('code', 'Clave'), ref('regionId', 'Región', 'regions'), { key: 'polygon', label: 'Polígono', type: 'polygon' }] },
  localities: { label: 'Localidades', singular: 'Localidad', domain: 'Territorial', fields: [text('name', 'Nombre'), ref('territoryId', 'Territorio', 'territories')] },
  sectors: { label: 'Sectores', singular: 'Sector', domain: 'Territorial', fields: [text('name', 'Nombre'), ref('localityId', 'Localidad', 'localities')] },
  operators: { label: 'Operadores', singular: 'Operador', domain: 'Operativo', fields: [text('name', 'Nombre'), ref('roleId', 'Rol operativo', 'roles')] },
  roles: { label: 'Roles', singular: 'Rol', domain: 'Operativo', fields: [text('name', 'Nombre'), text('description', 'Descripción', false)] },
  assignments: { label: 'Asignaciones', singular: 'Asignación', domain: 'Operativo', fields: [ref('operatorId', 'Operador', 'operators'), select('level', 'Nivel', ['Región', 'Territorio', 'Localidad', 'Sector']), text('targetId', 'Unidad territorial')] },
  houses: { label: 'Casas', singular: 'Casa', domain: 'Electoral', fields: [text('name', 'Identificador'), text('address', 'Dirección'), ref('sectorId', 'Sector', 'sectors'), select('status', 'Estado de visita', ['Pendiente', 'Visitada']), { key: 'lat', label: 'Latitud', type: 'number', min: -90, max: 90, required: true }, { key: 'lng', label: 'Longitud', type: 'number', min: -180, max: 180, required: true }] },
  citizens: { label: 'Ciudadanos', singular: 'Ciudadano', domain: 'Electoral', fields: [text('name', 'Nombre'), ref('houseId', 'Casa', 'houses'), select('status', 'Estado de registro', ['Por verificar', 'Verificado'])] }
};
export const assignmentLevels = { 'Región': 'regions', 'Territorio': 'territories', 'Localidad': 'localities', 'Sector': 'sectors' };

// Business validations are injected into the generic store.
export function validateBusiness(entity, record, data) {
  if (entity === 'assignments') {
    const collection = assignmentLevels[record.level];
    if (!collection || !data[collection].some(x => x.id === record.targetId && !x.deletedAt)) throw new Error('La unidad territorial no pertenece al nivel seleccionado.');
    if (data.assignments.some(x => !x.deletedAt && x.id !== record.id && x.operatorId === record.operatorId && x.level === record.level && x.targetId === record.targetId)) throw new Error('Esta asignación ya existe.');
  }
  if (['regions', 'territories'].includes(entity) && data[entity].some(x => !x.deletedAt && x.id !== record.id && x.code.toLowerCase() === record.code.toLowerCase())) throw new Error('La clave ya está registrada.');
}
export function canDelete(entity, record, data) {
  const level = Object.keys(assignmentLevels).find(x => assignmentLevels[x] === entity);
  if (level && data.assignments.some(x => !x.deletedAt && x.level === level && x.targetId === record.id)) throw new Error('La unidad tiene asignaciones activas. Retíralas primero.');
}
