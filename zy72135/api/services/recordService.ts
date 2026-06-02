import {
  findAllRecords,
  findRecordById,
  updateRecord,
  findVersionHistory,
  createVersionHistory,
  initMockDatabase,
} from '../db/mockDb';
import type { TrackCleanupRecord, FilterState } from '../../shared/types';

const fieldLabels: Record<string, string> = {
  currentNote: '备注',
  status: '状态',
  trackName: '曲目名称',
  artistName: '艺人',
  hasAuthorization: '授权状态',
  isDuplicate: '重复标记',
  isOldMaster: '旧版母带标记',
  isRenamed: '改名标记',
};

function getOldValue(record: TrackCleanupRecord, field: string): string {
  const value = (record as any)[field];
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value || '');
}

export function initDatabase() {
  initMockDatabase();
}

export function getAllRecords(filters?: FilterState) {
  return findAllRecords(filters);
}

export function getRecordById(id: string) {
  return findRecordById(id);
}

export function getRecordVersions(id: string) {
  return findVersionHistory(id);
}

export function updateRecordService(
  id: string,
  updates: Partial<TrackCleanupRecord>,
  modifiedBy: string
) {
  const existingRecord = findRecordById(id);
  if (!existingRecord) {
    return undefined;
  }

  const updatedRecord = updateRecord(id, updates);
  if (!updatedRecord) {
    return undefined;
  }

  Object.keys(updates).forEach((field) => {
    const oldValue = getOldValue(existingRecord, field);
    const newValue = getOldValue(updatedRecord, field);
    if (oldValue !== newValue) {
      createVersionHistory(
        id,
        fieldLabels[field] || field,
        oldValue,
        newValue,
        modifiedBy
      );
    }
  });

  return updatedRecord;
}

export function supplementRecordService(id: string, oldChannelInfo: string, modifiedBy: string) {
  const existingRecord = findRecordById(id);
  if (!existingRecord) {
    return undefined;
  }

  const newNote = existingRecord.currentNote
    ? `${existingRecord.currentNote}\n\n【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`
    : `【补充材料 - 舞台通道表旧口径】\n${oldChannelInfo}`;

  return updateRecordService(
    id,
    {
      currentNote: newNote,
      source: 'imported_old',
      latestHandler: modifiedBy,
      latestHandleTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    },
    modifiedBy
  );
}
