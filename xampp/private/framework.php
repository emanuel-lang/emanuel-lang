<?php
declare(strict_types=1);
if (!defined('SIGEIA_APP')) { http_response_code(403); exit; }
class DomainError extends RuntimeException {}
function active_rows(array $data, string $entity): array { return array_values(array_filter($data[$entity] ?? [], fn($row) => empty($row['deletedAt']))); }
function definition(array $definitions, string $entity): array {
    if (!array_key_exists($entity, $definitions)) throw new DomainError('Dominio desconocido.');
    return $definitions[$entity];
}
function save_record(array &$data, array $definitions, string $entity, array $input, ?string $id, callable $businessValidation): array {
    $def = definition($definitions, $entity);
    $previous = null;
    foreach (active_rows($data, $entity) as $row) if ($row['id'] === $id) $previous = $row;
    if ($id !== null && $previous === null) throw new DomainError('Registro no encontrado.');
    $now = gmdate('Y-m-d\TH:i:s\Z');
    $record = ['id'=>$previous['id'] ?? bin2hex(random_bytes(16)), 'createdAt'=>$previous['createdAt'] ?? $now, 'updatedAt'=>$now];
    foreach ($def['fields'] as $field) {
        $value = $input[$field['key']] ?? null;
        if ($value === null || $value === '') {
            if ($field['required'] ?? false) throw new DomainError($field['label'].': campo obligatorio.');
            $record[$field['key']] = $field['type'] === 'polygon' ? [] : ''; continue;
        }
        if ($field['type'] === 'number') {
            if ((!is_string($value) && !is_int($value) && !is_float($value)) || !is_numeric($value) || !is_finite((float)$value) || (float)$value < $field['min'] || (float)$value > $field['max']) throw new DomainError($field['label'].': valor fuera de rango.');
            $value = (float)$value;
        } elseif ($field['type'] === 'polygon') {
            if (!is_array($value) || !array_is_list($value) || (count($value)>0 && count($value)<3) || count($value)>2000) throw new DomainError('El polígono necesita al menos tres coordenadas válidas.');
            foreach ($value as $point) if (!is_array($point) || !array_is_list($point) || count($point)!==2 || (!is_int($point[0]) && !is_float($point[0])) || (!is_int($point[1]) && !is_float($point[1])) || !is_finite((float)$point[0]) || !is_finite((float)$point[1]) || abs($point[0])>90 || abs($point[1])>180) throw new DomainError('Coordenadas inválidas.');
        } else {
            if (!is_string($value) || preg_match_all('/./us', $value)>500) throw new DomainError($field['label'].': texto inválido (máximo 500 caracteres).');
            $value = trim($value);
            if (($field['required'] ?? false) && $value === '') throw new DomainError($field['label'].': campo obligatorio.');
            if ($field['type'] === 'select' && !in_array($value, $field['options'], true)) throw new DomainError($field['label'].': opción inválida.');
            if ($field['type'] === 'reference' && !array_filter(active_rows($data, $field['entity']), fn($row) => $row['id'] === $value)) throw new DomainError($field['label'].': referencia inválida.');
        }
        $record[$field['key']] = $value;
    }
    $businessValidation($entity, $record, $data);
    if ($previous) { foreach ($data[$entity] as &$row) if ($row['id'] === $id) $row = $record; unset($row); }
    else $data[$entity][] = $record;
    return $record;
}
function remove_record(array &$data, array $definitions, string $entity, string $id, callable $businessRestriction): void {
    definition($definitions, $entity);
    $exists = array_filter(active_rows($data, $entity), fn($row) => $row['id'] === $id);
    if (!$exists) throw new DomainError('Registro no encontrado.');
    foreach ($definitions as $key=>$def) foreach ($def['fields'] as $field) {
        if ($field['type'] === 'reference' && $field['entity'] === $entity && array_filter(active_rows($data, $key), fn($row) => $row[$field['key']] === $id)) throw new DomainError('El registro tiene dependencias activas. Retíralas primero.');
    }
    $businessRestriction($entity, $id, $data);
    foreach ($data[$entity] as &$row) if ($row['id'] === $id) $row['deletedAt'] = gmdate('Y-m-d\TH:i:s\Z');
    unset($row);
}
