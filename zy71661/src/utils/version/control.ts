import type { Simulation, Version, ImportCheckResult, DiffResult } from '@/types/simulation';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';

export function checkImportData(existingData: Simulation, importData: Simulation): ImportCheckResult {
  if (existingData.id === importData.id) {
    const differences: string[] = [];
    const conflictFields: string[] = [];

    if (JSON.stringify(existingData.physicsParams) !== JSON.stringify(importData.physicsParams)) {
      differences.push('physicsParams');
      conflictFields.push('physicsParams');
    }
    if (existingData.dataPoints.length !== importData.dataPoints.length) {
      differences.push('dataPoints');
    }
    if (existingData.notes.length !== importData.notes.length) {
      differences.push('notes');
    }
    if (existingData.attachments.length !== importData.attachments.length) {
      differences.push('attachments');
    }

    if (differences.length === 0) {
      return { status: 'duplicate', differences: [], conflictFields: [] };
    }
    return conflictFields.length > 0
      ? { status: 'conflict', differences, conflictFields }
      : { status: 'update', differences, conflictFields };
  }
  return { status: 'new', differences: [], conflictFields: [] };
}

export function compareVersions(version1: Version, version2: Version): DiffResult {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  try {
    const data1 = JSON.parse(version1.diffData) as Record<string, unknown>;
    const data2 = JSON.parse(version2.diffData) as Record<string, unknown>;
    const keys1 = Object.keys(data1);
    const keys2 = Object.keys(data2);

    for (const key of keys2) {
      if (!keys1.includes(key)) added.push(key);
      else if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) modified.push(key);
    }
    for (const key of keys1) {
      if (!keys2.includes(key)) removed.push(key);
    }
  } catch {
    // fallback
  }

  return { added, removed, modified };
}

export function createVersion(simulation: Simulation, parentVersion: Version | null, changeSummary: string, createdBy: string): Version {
  return {
    id: nanoid(),
    versionNumber: (parentVersion?.versionNumber || 0) + 1,
    parentId: parentVersion?.id,
    changeSummary,
    diffData: JSON.stringify(simulation),
    createdAt: dayjs().toISOString(),
    createdBy,
    importStatus: 'new',
  };
}
