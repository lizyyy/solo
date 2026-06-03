import type * as T from '@/types';

function generateId(): string {
  return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function trackChange(
  entityType: T.ChangeHistory['entityType'],
  entityId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  operator: string
): T.ChangeHistory {
  return {
    id: generateId(),
    entityType,
    entityId,
    fieldName,
    oldValue,
    newValue,
    operator,
    operatedAt: new Date().toISOString(),
  };
}

export function getHistory(
  histories: T.ChangeHistory[],
  entityType: T.ChangeHistory['entityType'],
  entityId: string
): T.ChangeHistory[] {
  return histories.filter(
    (h) => h.entityType === entityType && h.entityId === entityId
  );
}

export function generateDiff(
  oldValue: string,
  newValue: string
): { removed: string[]; added: string[] } {
  const oldLines = oldValue.split('\n').filter((l) => l.trim());
  const newLines = newValue.split('\n').filter((l) => l.trim());

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const removed = oldLines.filter((line) => !newSet.has(line));
  const added = newLines.filter((line) => !oldSet.has(line));

  return { removed, added };
}
