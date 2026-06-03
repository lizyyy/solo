import { TaxNoteVersion, StatusHistory, ProcessingStatus, TaxNote } from '@/types';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createVersionRecord(
  taxNoteId: string,
  versionNumber: number,
  fieldName: string,
  oldValue: string,
  newValue: string,
  changedBy: string,
  changeReason: string
): TaxNoteVersion {
  return {
    id: generateUUID(),
    taxNoteId,
    versionNumber,
    fieldName,
    oldValue,
    newValue,
    changedBy,
    changedAt: new Date().toISOString(),
    changeReason,
  };
}

export function createStatusHistoryRecord(
  taxNoteId: string,
  fromStatus: ProcessingStatus | null,
  toStatus: ProcessingStatus,
  operatedBy: string,
  remark: string
): StatusHistory {
  return {
    id: generateUUID(),
    taxNoteId,
    fromStatus,
    toStatus,
    operatedBy,
    operatedAt: new Date().toISOString(),
    remark,
  };
}

export function getVersionsForTaxNote(
  allVersions: TaxNoteVersion[],
  taxNoteId: string
): TaxNoteVersion[] {
  return allVersions
    .filter(v => v.taxNoteId === taxNoteId)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}

export function getStatusHistoryForTaxNote(
  allHistories: StatusHistory[],
  taxNoteId: string
): StatusHistory[] {
  return allHistories
    .filter(h => h.taxNoteId === taxNoteId)
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
}

export function compareVersions(
  version1: TaxNoteVersion,
  version2: TaxNoteVersion
): { field: string; oldValue: string; newValue: string }[] {
  const changes: { field: string; oldValue: string; newValue: string }[] = [];

  if (version1.fieldName === version2.fieldName) {
    changes.push({
      field: version1.fieldName,
      oldValue: version1.oldValue,
      newValue: version2.newValue,
    });
  }

  return changes;
}

export function rollbackToVersion(
  currentTaxNote: TaxNote,
  targetVersion: TaxNoteVersion,
  currentUser: string,
  reason: string
): { updatedTaxNote: TaxNote; newVersion: TaxNoteVersion } {
  const updatedTaxNote: TaxNote = {
    ...currentTaxNote,
    [targetVersion.fieldName as keyof TaxNote]: targetVersion.oldValue as never,
    version: currentTaxNote.version + 1,
    updatedBy: currentUser,
    updatedAt: new Date().toISOString(),
  };

  const newVersion = createVersionRecord(
    currentTaxNote.id,
    updatedTaxNote.version,
    targetVersion.fieldName,
    targetVersion.newValue,
    targetVersion.oldValue,
    currentUser,
    `回滚: ${reason}`
  );

  return { updatedTaxNote, newVersion };
}
