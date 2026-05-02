import { WorkOrder, ConflictRecord, Photo } from '../types';

export interface DiffField {
  field: string;
  label: string;
  localValue: unknown;
  remoteValue: unknown;
  isDifferent: boolean;
}

export interface ConflictDiff {
  workOrderId: string;
  fields: DiffField[];
  photosDiff: {
    added: Photo[];
    removed: Photo[];
    modified: Photo[];
  };
  timestamp: string;
}

export function computeDiff(local: WorkOrder, remote: WorkOrder): ConflictDiff {
  const fields: DiffField[] = [];

  const statusDiff = compareValues('status', '状态', local.status, remote.status);
  if (statusDiff) fields.push(statusDiff);

  const notesDiff = compareValues('notes', '备注', local.notes, remote.notes);
  if (notesDiff) fields.push(notesDiff);

  const versionDiff = compareValues('version', '版本号', local.version, remote.version);
  if (versionDiff) fields.push(versionDiff);

  const localPhotoMap = new Map(local.photos.map(p => [p.id, p]));
  const remotePhotoMap = new Map(remote.photos.map(p => [p.id, p]));

  const added: Photo[] = [];
  const removed: Photo[] = [];
  const modified: Photo[] = [];

  for (const [id, photo] of remotePhotoMap) {
    if (!localPhotoMap.has(id)) {
      added.push(photo);
    } else {
      const localPhoto = localPhotoMap.get(id)!;
      if (localPhoto.caption !== photo.caption || localPhoto.url !== photo.url) {
        modified.push({ ...photo, caption: `[本地: ${localPhoto.caption}] → [远端: ${photo.caption}]` });
      }
    }
  }

  for (const [id, photo] of localPhotoMap) {
    if (!remotePhotoMap.has(id)) {
      removed.push(photo);
    }
  }

  return {
    workOrderId: local.id,
    fields,
    photosDiff: { added, removed, modified },
    timestamp: new Date().toISOString()
  };
}

function compareValues(
  field: string,
  label: string,
  localValue: unknown,
  remoteValue: unknown
): DiffField | null {
  const isDifferent = JSON.stringify(localValue) !== JSON.stringify(remoteValue);
  return {
    field,
    label,
    localValue,
    remoteValue,
    isDifferent
  };
}

export function createMergedVersion(
  local: WorkOrder,
  remote: WorkOrder,
  fieldSelections: Record<string, 'local' | 'remote'>
): WorkOrder {
  const merged: WorkOrder = { ...local, photos: [...local.photos] };

  for (const [field, selection] of Object.entries(fieldSelections)) {
    if (field === 'photos') {
      merged.photos = selection === 'local' ? [...local.photos] : [...remote.photos];
    } else if (field === 'status') {
      merged.status = selection === 'local' ? local.status : remote.status;
    } else if (field === 'notes') {
      merged.notes = selection === 'local' ? local.notes : remote.notes;
    }
  }

  return merged;
}

export function generateConflictReport(conflicts: ConflictRecord[]): string {
  const report = {
    generatedAt: new Date().toISOString(),
    totalConflicts: conflicts.length,
    conflicts: conflicts.map(c => ({
      workOrderId: c.workOrderId,
      localVersion: {
        version: c.localVersion.version,
        status: c.localVersion.status,
        notes: c.localVersion.notes,
        photos: c.localVersion.photos.length,
        updatedAt: c.localVersion.updatedAt,
        updatedBy: c.localVersion.updatedBy
      },
      remoteVersion: {
        version: c.remoteVersion.version,
        status: c.remoteVersion.status,
        notes: c.remoteVersion.notes,
        photos: c.remoteVersion.photos.length,
        updatedAt: c.remoteVersion.updatedAt,
        updatedBy: c.remoteVersion.updatedBy
      },
      resolution: c.resolution || 'unresolved',
      resolvedVersion: c.resolvedVersion ? {
        version: c.resolvedVersion.version,
        status: c.resolvedVersion.status,
        notes: c.resolvedVersion.notes
      } : null,
      timestamp: c.timestamp
    }))
  };

  return JSON.stringify(report, null, 2);
}

export function downloadConflictReport(conflicts: ConflictRecord[]): void {
  const report = generateConflictReport(conflicts);
  const blob = new Blob([report], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conflict_report.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
