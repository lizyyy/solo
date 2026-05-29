import * as Diff from 'diff';
import type { DiffResult, FieldChange, ShotVersion } from '@/types';

export function computeDiff(oldStr: string, newStr: string): string {
  const diff = Diff.diffWords(oldStr || '', newStr || '');
  return JSON.stringify(diff);
}

export function parseDiff(diffJson: string): Array<{
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}> {
  try {
    const parsed = JSON.parse(diffJson);
    return parsed.map((part: any) => ({
      type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
      value: part.value,
    }));
  } catch {
    return [{ type: 'unchanged', value: diffJson }];
  }
}

export function detectFieldChanges(
  oldVersion: ShotVersion,
  newData: Partial<ShotVersion>,
  reason: string,
  userId: string
): Omit<FieldChange, 'versionId'>[] {
  const changes: Omit<FieldChange, 'versionId'>[] = [];
  const trackFields: Array<keyof ShotVersion> = [
    'title',
    'dialogue',
    'actionDescription',
    'artNotes',
    'vfxNotes',
    'referenceLinks',
    'duration',
    'storyboardImage',
  ];

  for (const field of trackFields) {
    const oldValue = String(oldVersion[field] ?? '');
    const newValue = String(newData[field] ?? oldValue);

    if (oldValue !== newValue) {
      changes.push({
        id: '',
        fieldName: field as string,
        oldValue,
        newValue,
        diff: computeDiff(oldValue, newValue),
        reason,
        modifiedBy: userId,
        modifiedAt: new Date().toISOString(),
      });
    }
  }

  return changes;
}

export function compareVersions(
  v1: ShotVersion,
  v2: ShotVersion
): DiffResult[] {
  const results: DiffResult[] = [];
  const compareFields: Array<keyof ShotVersion> = [
    'title',
    'dialogue',
    'actionDescription',
    'artNotes',
    'vfxNotes',
    'referenceLinks',
    'duration',
  ];

  for (const field of compareFields) {
    const oldValue = String(v1[field] ?? '');
    const newValue = String(v2[field] ?? '');

    if (oldValue !== newValue) {
      const diff = Diff.diffWords(oldValue, newValue);
      results.push({
        fieldName: field as string,
        oldValue,
        newValue,
        changes: diff.map((part) => ({
          type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
          value: part.value,
        })),
      });
    }
  }

  return results;
}
