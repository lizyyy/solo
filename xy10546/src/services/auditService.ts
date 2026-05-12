import { v4 as uuidv4 } from 'uuid';
import { AuditRecord, DiffItem } from '../types';
import { loadStore, saveStore } from '../store/dataStore';

export function recordAudit(
  targetType: 'invoice' | 'reimbursement' | 'correction',
  targetId: string,
  action: string,
  operatorId: string,
  operatorName: string,
  options: {
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    diff?: DiffItem[];
    reason?: string;
  } = {}
): AuditRecord {
  const store = loadStore();
  
  const record: AuditRecord = {
    id: uuidv4(),
    targetType,
    targetId,
    action,
    operatorId,
    operatorName,
    beforeState: options.beforeState,
    afterState: options.afterState,
    diff: options.diff,
    reason: options.reason,
    timestamp: new Date().toISOString()
  };
  
  store.auditRecords.push(record);
  saveStore(store);
  return record;
}

export function getAuditHistory(
  targetType: 'invoice' | 'reimbursement' | 'correction',
  targetId: string
): AuditRecord[] {
  const store = loadStore();
  return store.auditRecords
    .filter(r => r.targetType === targetType && r.targetId === targetId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function getAllAuditRecords(): AuditRecord[] {
  const store = loadStore();
  return [...store.auditRecords].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function computeDiff<T extends Record<string, any>>(
  before: T,
  after: T,
  keysToCompare: (keyof T)[]
): DiffItem[] {
  const diffs: DiffItem[] = [];
  
  for (const key of keysToCompare) {
    const beforeVal = before[key];
    const afterVal = after[key];
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({
        field: String(key),
        before: beforeVal,
        after: afterVal
      });
    }
  }
  
  return diffs;
}
