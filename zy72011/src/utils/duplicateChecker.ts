import { WarningRecord, ImportResult, DiffItem } from '../types';
import { compareRecords, isConflict } from './diffEngine';

type DuplicateAction = 'skip' | 'update' | 'conflict';

export interface DuplicateCheckResult {
  action: DuplicateAction;
  existingRecord?: WarningRecord;
  diffs: DiffItem[];
}

export function checkDuplicate(
  newRecord: WarningRecord,
  existingRecords: WarningRecord[]
): DuplicateCheckResult {
  const existingRecord = existingRecords.find(
    (r) =>
      r.supplierName === newRecord.supplierName &&
      r.billAmount === newRecord.billAmount &&
      r.warningType === newRecord.warningType
  );

  if (!existingRecord) {
    return { action: 'skip', diffs: [] };
  }

  const diffs = compareRecords(existingRecord, newRecord);

  if (diffs.length === 0) {
    return { action: 'skip', existingRecord, diffs: [] };
  }

  if (isConflict(existingRecord, newRecord)) {
    return { action: 'conflict', existingRecord, diffs };
  }

  return { action: 'update', existingRecord, diffs };
}

export function processImport(
  newRecords: WarningRecord[],
  existingRecords: WarningRecord[]
): ImportResult & { recordsToAdd: WarningRecord[]; recordsToUpdate: WarningRecord[] } {
  const result: ImportResult & { recordsToAdd: WarningRecord[]; recordsToUpdate: WarningRecord[] } = {
    total: newRecords.length,
    skipped: 0,
    updated: 0,
    conflicts: 0,
    conflictItems: [],
    diffReport: [],
    recordsToAdd: [],
    recordsToUpdate: [],
  };

  newRecords.forEach((record) => {
    const checkResult = checkDuplicate(record, existingRecords);

    switch (checkResult.action) {
      case 'skip':
        if (checkResult.existingRecord) {
          result.skipped++;
        } else {
          result.recordsToAdd.push(record);
        }
        break;
      case 'update':
        result.updated++;
        result.recordsToUpdate.push(record);
        if (checkResult.diffs.length > 0) {
          result.diffReport.push({ recordId: record.id, diffs: checkResult.diffs });
        }
        break;
      case 'conflict':
        result.conflicts++;
        result.conflictItems.push(record.supplierName);
        result.diffReport.push({ recordId: record.id, diffs: checkResult.diffs });
        break;
    }
  });

  return result;
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
