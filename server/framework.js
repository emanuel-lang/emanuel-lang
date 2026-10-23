import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export class ValidationError extends Error {}
export class Store {
  constructor({ definitions, file, seed, validate = () => {}, beforeDelete = () => {} }) {
    this.definitions = definitions;
    this.file = file;
    this.validate = validate;
    this.beforeDelete = beforeDelete;
    this.data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : structuredClone(seed);
    for (const key of Object.keys(definitions)) this.data[key] ||= [];
    this.persist();
  }
  persist() {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    writeFileSync(this.file + '.tmp', JSON.stringify(this.data, null, 2), { mode: 0o600 });
    renameSync(this.file + '.tmp', this.file);
  }
  definition(entity) {
    if (!Object.hasOwn(this.definitions, entity)) throw new ValidationError('Dominio desconocido.');
    return this.definitions[entity];
  }
  list(entity) { this.definition(entity); return this.data[entity].filter(x => !x.deletedAt); }
  save(entity, input, id) {
    const definition = this.definition(entity);
    const previous = id ? this.list(entity).find(x => x.id === id) : null;
    if (id && !previous) throw new ValidationError('Registro no encontrado.');
    const record = { id: previous?.id || randomUUID(), createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    for (const field of definition.fields) {
      const value = input[field.key];
      if (value === undefined || value === null || value === '') {
        if (field.required) throw new ValidationError(`${field.label}: campo obligatorio.`);
        record[field.key] = field.type === 'polygon' ? [] : '';
        continue;
      }
      if (field.type === 'number') {
        if ((typeof value !== 'number' && typeof value !== 'string') || !Number.isFinite(Number(value)) || Number(value) < field.min || Number(value) > field.max) throw new ValidationError(`${field.label}: valor fuera de rango.`);
        record[field.key] = Number(value);
      } else if (field.type === 'polygon') {
        if (!Array.isArray(value) || (value.length > 0 && value.length < 3) || value.length > 2000 || value.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) throw new ValidationError('El polígono necesita al menos tres coordenadas válidas.');
        record[field.key] = value;
      } else {
        if (typeof value !== 'string' || value.trim().length > 500) throw new ValidationError(`${field.label}: texto inválido (máximo 500 caracteres).`);
        record[field.key] = value.trim();
        if (field.required && !record[field.key]) throw new ValidationError(`${field.label}: campo obligatorio.`);
        if (field.type === 'select' && !field.options.includes(record[field.key])) throw new ValidationError(`${field.label}: opción inválida.`);
        if (field.type === 'reference' && !this.list(field.entity).some(x => x.id === record[field.key])) throw new ValidationError(`${field.label}: referencia inválida.`);
      }
    }
    try { this.validate(entity, record, this.data); } catch (error) { throw new ValidationError(error.message); }
    const old = this.data[entity];
    this.data[entity] = previous ? old.map(x => x.id === id ? record : x) : [...old, record];
    try { this.persist(); } catch (error) { this.data[entity] = old; throw error; }
    return record;
  }
  remove(entity, id) {
    const record = this.list(entity).find(x => x.id === id);
    if (!record) throw new ValidationError('Registro no encontrado.');
    for (const [key, def] of Object.entries(this.definitions)) {
      if (def.fields.some(f => f.type === 'reference' && f.entity === entity && this.list(key).some(x => x[f.key] === id))) throw new ValidationError('El registro tiene dependencias activas. Retíralas primero.');
    }
    try { this.beforeDelete(entity, record, this.data); } catch (error) { throw new ValidationError(error.message); }
    record.deletedAt = new Date().toISOString();
    try { this.persist(); } catch (error) { delete record.deletedAt; throw error; }
  }
}
