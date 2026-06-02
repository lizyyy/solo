import type { RoomAllocation, ConflictItem } from '@/types';
import { generateRecordHash } from './dataQuality';

const COMPARE_FIELDS = ['roomType', 'checkInDate', 'checkOutDate', 'hotelName'] as const;

const FIELD_LABELS: Record<string, string> = {
  roomType: '房型',
  checkInDate: '入住日期',
  checkOutDate: '退房日期',
  hotelName: '酒店名称',
  personName: '入住人',
  personType: '人员类型',
};

export const detectConflicts = (
  oldRecords: RoomAllocation[],
  newRecords: Partial<RoomAllocation>[]
): ConflictItem[] => {
  const conflicts: ConflictItem[] = [];
  const oldRecordMap = new Map<string, RoomAllocation>();
  
  oldRecords.forEach(record => {
    const hash = generateRecordHash(record);
    oldRecordMap.set(hash, record);
  });
  
  newRecords.forEach(newRecord => {
    const hash = generateRecordHash(newRecord);
    const oldRecord = oldRecordMap.get(hash);
    
    if (oldRecord) {
      COMPARE_FIELDS.forEach(field => {
        const oldValue = String(oldRecord[field] || '');
        const newValue = String(newRecord[field as keyof RoomAllocation] || '');
        
        if (oldValue !== newValue && oldValue.trim() !== '' && newValue.trim() !== '') {
          conflicts.push({
            recordId: oldRecord.id,
            fieldName: field,
            oldValue,
            newValue,
            oldSource: oldRecord.source,
            newSource: newRecord.source || '新导入数据',
            suggestion: `【${FIELD_LABELS[field] || field}】两边不一样：${oldRecord.source}写的是「${oldValue}」，但新数据写的是「${newValue}」，你看看哪边对？`,
          });
        }
      });
    }
  });
  
  return conflicts;
};

export const resolveConflict = (
  conflicts: ConflictItem[],
  recordId: string,
  fieldName: string,
  choice: 'keep' | 'adopt'
): ConflictItem[] => {
  return conflicts.filter(
    c => !(c.recordId === recordId && c.fieldName === fieldName)
  );
};

export const groupConflictsByRecord = (conflicts: ConflictItem[]): Map<string, ConflictItem[]> => {
  const grouped = new Map<string, ConflictItem[]>();
  
  conflicts.forEach(conflict => {
    if (!grouped.has(conflict.recordId)) {
      grouped.set(conflict.recordId, []);
    }
    grouped.get(conflict.recordId)!.push(conflict);
  });
  
  return grouped;
};
