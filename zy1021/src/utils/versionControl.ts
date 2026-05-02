import { ChangeSet, ConflictType, Conflict, InspectionItem } from '../types';
import { generateId } from './index';

export const incrementVersion = (currentVersion: number): number => {
  return currentVersion + 1;
};

export const checkConflict = (
  clientChange: ChangeSet,
  serverHistory: ChangeSet[]
): { conflict: Conflict | null; serverChange: ChangeSet | null } => {
  const sameItemAndFieldChanges = serverHistory.filter(
    change => change.itemId === clientChange.itemId &&
               change.field === clientChange.field &&
               change.version > clientChange.version
  );

  if (sameItemAndFieldChanges.length > 0) {
    const latestServerChange = sameItemAndFieldChanges.reduce(
      (latest, current) => current.version > latest.version ? current : latest
    );

    const conflict: Conflict = {
      id: generateId(),
      type: ConflictType.SAME_FIELD_CONFLICT,
      serverChange: latestServerChange,
      clientChange: clientChange,
      resolved: false
    };

    return { conflict, serverChange: latestServerChange };
  }

  const sameItemDifferentFieldChanges = serverHistory.filter(
    change => change.itemId === clientChange.itemId &&
               change.field !== clientChange.field &&
               change.version > clientChange.version
  );

  if (sameItemDifferentFieldChanges.length > 0) {
    return { conflict: null, serverChange: null };
  }

  const olderVersionChanges = serverHistory.filter(
    change => change.version > clientChange.version
  );

  if (olderVersionChanges.length > 0) {
    const latestServerChange = olderVersionChanges.reduce(
      (latest, current) => current.version > latest.version ? current : latest
    );

    const conflict: Conflict = {
      id: generateId(),
      type: ConflictType.OLD_VERSION_SUBMIT,
      serverChange: latestServerChange,
      clientChange: clientChange,
      resolved: false
    };

    return { conflict, serverChange: latestServerChange };
  }

  return { conflict: null, serverChange: null };
};

export const mergeChanges = (
  baseItem: InspectionItem,
  changes: ChangeSet[]
): InspectionItem => {
  const mergedItem = { ...baseItem };
  
  changes.forEach(change => {
    if (change.itemId === baseItem.id) {
      (mergedItem as Record<string, unknown>)[change.field] = change.newValue;
    }
  });

  return mergedItem;
};

export const resolveConflict = (
  conflict: Conflict,
  selectedValue: unknown,
  resolvedBy: string
): Conflict => {
  return {
    ...conflict,
    resolved: true,
    resolvedBy,
    resolvedAt: Date.now(),
    selectedValue
  };
};

export const getConflictDescription = (type: ConflictType): string => {
  switch (type) {
    case ConflictType.SAME_FIELD_CONFLICT:
      return '同一字段冲突：不同设备修改了同一字段';
    case ConflictType.OLD_VERSION_SUBMIT:
      return '旧版本提交：基于旧版本的修改尝试覆盖新版本';
    case ConflictType.NO_CONFLICT:
      return '无冲突';
    default:
      return '未知冲突类型';
  }
};
