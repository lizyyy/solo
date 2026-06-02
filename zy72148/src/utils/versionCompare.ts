import type { RoomAllocation } from '@/types';
import { generateRecordHash } from './dataQuality';

export interface VersionDiff {
  type: 'added' | 'removed' | 'modified';
  record: RoomAllocation;
  oldRecord?: RoomAllocation;
  modifiedFields?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

export const compareVersions = (
  oldRecords: RoomAllocation[],
  newRecords: RoomAllocation[]
): VersionDiff[] => {
  const diffs: VersionDiff[] = [];
  const oldMap = new Map<string, RoomAllocation>();
  const newMap = new Map<string, RoomAllocation>();
  
  oldRecords.forEach(record => {
    const hash = generateRecordHash(record);
    oldMap.set(hash, record);
  });
  
  newRecords.forEach(record => {
    const hash = generateRecordHash(record);
    newMap.set(hash, record);
  });
  
  newMap.forEach((newRecord, hash) => {
    const oldRecord = oldMap.get(hash);
    if (!oldRecord) {
      diffs.push({
        type: 'added',
        record: newRecord,
      });
    } else {
      const modifiedFields: VersionDiff['modifiedFields'] = [];
      const fields = ['roomType', 'personName', 'personType', 'checkInDate', 'checkOutDate', 'hotelName', 'remarks', 'status'] as const;
      
      fields.forEach(field => {
        const oldVal = String(oldRecord[field] || '');
        const newVal = String(newRecord[field] || '');
        if (oldVal !== newVal) {
          modifiedFields!.push({
            field,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      });
      
      if (modifiedFields!.length > 0) {
        diffs.push({
          type: 'modified',
          record: newRecord,
          oldRecord,
          modifiedFields,
        });
      }
    }
  });
  
  oldMap.forEach((oldRecord, hash) => {
    if (!newMap.has(hash)) {
      diffs.push({
        type: 'removed',
        record: oldRecord,
      });
    }
  });
  
  return diffs;
};

export const getDiffStats = (diffs: VersionDiff[]) => {
  const added = diffs.filter(d => d.type === 'added').length;
  const removed = diffs.filter(d => d.type === 'removed').length;
  const modified = diffs.filter(d => d.type === 'modified').length;
  
  return { added, removed, modified, total: diffs.length };
};
