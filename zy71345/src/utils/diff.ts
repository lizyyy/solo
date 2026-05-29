import { AllData, CheckResult } from '../types';

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffItem {
  field: string;
  type: DiffType;
  oldValue?: any;
  newValue?: any;
}

export interface DiffResult {
  parts: DiffItem[];
  musicians: DiffItem[];
  revisions: DiffItem[];
  distributions: DiffItem[];
  checkResults?: {
    oldResults: CheckResult[];
    newResults: CheckResult[];
  };
}

function compareArrays<T extends { id: string }>(
  oldArr: T[],
  newArr: T[],
  nameField: keyof T
): DiffItem[] {
  const diffs: DiffItem[] = [];
  const oldMap = new Map(oldArr.map((item) => [item.id, item]));
  const newMap = new Map(newArr.map((item) => [item.id, item]));

  oldArr.forEach((oldItem) => {
    const newItem = newMap.get(oldItem.id);
    const name = String(oldItem[nameField] || oldItem.id);
    
    if (!newItem) {
      diffs.push({
        field: name,
        type: 'removed',
        oldValue: oldItem,
      });
    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      diffs.push({
        field: name,
        type: 'modified',
        oldValue: oldItem,
        newValue: newItem,
      });
    } else {
      diffs.push({
        field: name,
        type: 'unchanged',
        oldValue: oldItem,
        newValue: newItem,
      });
    }
  });

  newArr.forEach((newItem) => {
    if (!oldMap.has(newItem.id)) {
      const name = String(newItem[nameField] || newItem.id);
      diffs.push({
        field: name,
        type: 'added',
        newValue: newItem,
      });
    }
  });

  return diffs;
}

export function compareData(oldData: AllData, newData: AllData): DiffResult {
  return {
    parts: compareArrays(oldData.parts, newData.parts, 'name'),
    musicians: compareArrays(oldData.musicians, newData.musicians, 'name'),
    revisions: compareArrays(oldData.revisions, newData.revisions, 'name'),
    distributions: compareArrays(oldData.distributions, newData.distributions, 'musicianId'),
  };
}

export function compareCheckResults(
  oldResults: CheckResult[],
  newResults: CheckResult[]
): {
  fixed: CheckResult[];
  newIssues: CheckResult[];
  remaining: CheckResult[];
} {
  const fixed: CheckResult[] = [];
  const newIssues: CheckResult[] = [];
  const remaining: CheckResult[] = [];

  const oldIssueKeys = new Set(oldResults.map((r) => `${r.type}-${r.message}`));
  const newIssueKeys = new Set(newResults.map((r) => `${r.type}-${r.message}`));

  oldResults.forEach((r) => {
    const key = `${r.type}-${r.message}`;
    if (!newIssueKeys.has(key) && r.status !== 'resolved') {
      fixed.push(r);
    }
  });

  newResults.forEach((r) => {
    const key = `${r.type}-${r.message}`;
    if (!oldIssueKeys.has(key)) {
      newIssues.push(r);
    } else {
      remaining.push(r);
    }
  });

  return { fixed, newIssues, remaining };
}

export function getDiffStats(diff: DiffResult): {
  totalChanges: number;
  added: number;
  removed: number;
  modified: number;
} {
  let added = 0;
  let removed = 0;
  let modified = 0;

  const allDiffs = [
    ...diff.parts,
    ...diff.musicians,
    ...diff.revisions,
    ...diff.distributions,
  ];

  allDiffs.forEach((d) => {
    if (d.type === 'added') added++;
    else if (d.type === 'removed') removed++;
    else if (d.type === 'modified') modified++;
  });

  return {
    totalChanges: added + removed + modified,
    added,
    removed,
    modified,
  };
}
