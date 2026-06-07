import type { ChangeHistory, EntityType, OperationType } from '@/types';
import { generateId } from './hash';

export function computeChangedFields(
  before: Record<string, any>,
  after: Record<string, any>
): string[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];

  for (const key of allKeys) {
    const beforeVal = JSON.stringify(before[key]);
    const afterVal = JSON.stringify(after[key]);
    if (beforeVal !== afterVal) {
      changed.push(key);
    }
  }

  return changed;
}

export function createChangeHistory(
  entityType: EntityType,
  entityId: string,
  beforeSnapshot: Record<string, any>,
  afterSnapshot: Record<string, any>,
  operationType: OperationType,
  operator: string
): ChangeHistory {
  const changedFields = computeChangedFields(beforeSnapshot, afterSnapshot);

  return {
    id: generateId(),
    entityType,
    entityId,
    beforeSnapshot: { ...beforeSnapshot },
    afterSnapshot: { ...afterSnapshot },
    changedFields,
    operationType,
    operator,
    operatedAt: new Date().toISOString(),
  };
}

export function snapshotEntity(entity: any): Record<string, any> {
  return JSON.parse(JSON.stringify(entity));
}
