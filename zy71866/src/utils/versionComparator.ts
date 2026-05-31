import { MaterialPack, Record, ChangeItem } from '@/types';

export function compareVersions(
  oldPack: MaterialPack,
  newPack: MaterialPack
): ChangeItem[] {
  const changes: ChangeItem[] = [];
  
  const oldIds = new Set(oldPack.records.map(r => r.id));
  const newIds = new Set(newPack.records.map(r => r.id));
  
  newIds.forEach(id => {
    if (!oldIds.has(id)) {
      changes.push({
        type: 'added',
        recordId: id
      });
    }
  });
  
  oldIds.forEach(id => {
    if (!newIds.has(id)) {
      changes.push({
        type: 'removed',
        recordId: id
      });
    }
  });
  
  const commonIds = [...oldIds].filter(id => newIds.has(id));
  commonIds.forEach(id => {
    const oldRecord = oldPack.records.find(r => r.id === id)!;
    const newRecord = newPack.records.find(r => r.id === id)!;
    
    const fieldChanges = compareRecords(oldRecord, newRecord);
    changes.push(...fieldChanges);
  });
  
  return changes;
}

function compareRecords(oldRecord: Record, newRecord: Record): ChangeItem[] {
  const changes: ChangeItem[] = [];
  
  const fields: (keyof Record)[] = [
    'studentAnswer', 'score', 'knowledgePoint', 'source'
  ];
  
  fields.forEach(field => {
    if (oldRecord[field] !== newRecord[field]) {
      changes.push({
        type: 'modified',
        recordId: oldRecord.id,
        field: field as string,
        oldValue: oldRecord[field],
        newValue: newRecord[field]
      });
    }
  });
  
  if (oldRecord.attachments.length !== newRecord.attachments.length) {
    changes.push({
      type: 'modified',
      recordId: oldRecord.id,
      field: 'attachments',
      oldValue: `${oldRecord.attachments.length} 个附件`,
      newValue: `${newRecord.attachments.length} 个附件`
    });
  }
  
  if (oldRecord.corrections.length !== newRecord.corrections.length) {
    changes.push({
      type: 'modified',
      recordId: oldRecord.id,
      field: 'corrections',
      oldValue: `${oldRecord.corrections.length} 条更正`,
      newValue: `${newRecord.corrections.length} 条更正`
    });
  }
  
  return changes;
}

export function formatChangeDescription(change: ChangeItem, records: Record[]): string {
  const record = records.find(r => r.id === change.recordId);
  const recordLabel = record ? `${record.studentName} - ${record.questionTitle}` : change.recordId;
  
  switch (change.type) {
    case 'added':
      return `新增记录: ${recordLabel}`;
    case 'removed':
      return `移除记录: ${recordLabel}`;
    case 'modified':
      return `修改 ${recordLabel} 的 ${change.field}: "${change.oldValue}" → "${change.newValue}"`;
    default:
      return '';
  }
}

export function hasSignificantChanges(changes: ChangeItem[]): boolean {
  return changes.some(change => {
    if (change.type !== 'modified') return true;
    const significantFields = ['score', 'studentAnswer', 'knowledgePoint'];
    return significantFields.includes(change.field || '');
  });
}
