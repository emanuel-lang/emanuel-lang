<?php
declare(strict_types=1);
if (!defined('SIGEIA_APP')) { http_response_code(403); exit; }
function validate_business(string $entity, array $record, array $data): void {
    if ($entity === 'assignments') {
        $collection = LEVELS[$record['level']] ?? null;
        if (!$collection || !array_filter(active_rows($data, $collection), fn($row) => $row['id'] === $record['targetId'])) throw new DomainError('La unidad territorial no pertenece al nivel seleccionado.');
        foreach (active_rows($data, 'assignments') as $row) if ($row['id'] !== $record['id'] && $row['operatorId'] === $record['operatorId'] && $row['level'] === $record['level'] && $row['targetId'] === $record['targetId']) throw new DomainError('Esta asignación ya existe.');
    }
    if (in_array($entity, ['regions','territories'], true)) foreach (active_rows($data, $entity) as $row) if ($row['id'] !== $record['id'] && strtolower($row['code']) === strtolower($record['code'])) throw new DomainError('La clave ya está registrada.');
}
function restrict_business_delete(string $entity, string $id, array $data): void {
    $level = array_search($entity, LEVELS, true);
    if ($level !== false) foreach (active_rows($data, 'assignments') as $row) if ($row['level'] === $level && $row['targetId'] === $id) throw new DomainError('La unidad tiene asignaciones activas. Retíralas primero.');
}
