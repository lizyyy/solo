import type { DiffResult, Snapshot } from './types';

export function deepCompare<T = unknown>(obj1: T, obj2: T): boolean {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    return false;
  }

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  const keys1 = Object.keys(obj1) as Array<keyof T>;
  const keys2 = Object.keys(obj2) as Array<keyof T>;

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false;
    if (!deepCompare(obj1[key], obj2[key])) return false;
  }

  return true;
}

export function compareSnapshots(
  snapshot1: Snapshot,
  snapshot2: Snapshot
): DiffResult {
  const diff: DiffResult = {
    added: {},
    removed: {},
    modified: {},
    unchanged: {}
  };

  const data1 = snapshot1.data;
  const data2 = snapshot2.data;

  const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);

  for (const key of allKeys) {
    const in1 = Object.prototype.hasOwnProperty.call(data1, key);
    const in2 = Object.prototype.hasOwnProperty.call(data2, key);

    if (in1 && !in2) {
      diff.removed[key] = data1[key];
    } else if (!in1 && in2) {
      diff.added[key] = data2[key];
    } else {
      const val1 = data1[key];
      const val2 = data2[key];
      if (deepCompare(val1, val2)) {
        diff.unchanged[key] = val1;
      } else {
        diff.modified[key] = { oldValue: val1, newValue: val2 };
      }
    }
  }

  return diff;
}

export function getChangeSummary(diffResult: DiffResult): string {
  const { added, removed, modified } = diffResult;
  const addedCount = Object.keys(added).length;
  const removedCount = Object.keys(removed).length;
  const modifiedCount = Object.keys(modified).length;

  const parts: string[] = [];

  if (addedCount > 0) {
    parts.push(`新增 ${addedCount} 项: ${Object.keys(added).join(', ')}`);
  }

  if (removedCount > 0) {
    parts.push(`删除 ${removedCount} 项: ${Object.keys(removed).join(', ')}`);
  }

  if (modifiedCount > 0) {
    const modifiedDetails = Object.entries(modified)
      .map(([key, value]) => {
        const oldStr = String(value.oldValue);
        const newStr = String(value.newValue);
        return `${key} (${oldStr.length > 30 ? oldStr.slice(0, 30) + '...' : oldStr} → ${newStr.length > 30 ? newStr.slice(0, 30) + '...' : newStr})`;
      })
      .join('; ');
    parts.push(`修改 ${modifiedCount} 项: ${modifiedDetails}`);
  }

  if (parts.length === 0) {
    return '无变更';
  }

  return parts.join(' | ');
}
