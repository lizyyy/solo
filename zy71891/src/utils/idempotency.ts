const IDEMPOTENCY_STORAGE_KEY = 'cold_storage_idempotency_keys';

interface IdempotencyRecord {
  key: string;
  warningIds: string[];
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  result?: unknown;
}

export function generateIdempotencyKey(operationType: string, warningIds: string[]): string {
  const sortedIds = [...warningIds].sort().join(',');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${operationType}_${sortedIds}_${timestamp}_${random}`;
}

export function checkIdempotency(key: string): IdempotencyRecord | null {
  try {
    const records = getIdempotencyRecords();
    return records.find(r => r.key === key) || null;
  } catch {
    return null;
  }
}

export function checkDuplicateOperation(operationType: string, warningIds: string[]): IdempotencyRecord | null {
  try {
    const records = getIdempotencyRecords();
    const sortedIds = [...warningIds].sort().join(',');
    
    return records.find(r => {
      const keyParts = r.key.split('_');
      const recordType = keyParts[0];
      const recordIds = keyParts[1];
      
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const createdAt = new Date(r.createdAt).getTime();
      
      return (
        recordType === operationType &&
        recordIds === sortedIds &&
        createdAt > fiveMinutesAgo &&
        (r.status === 'processing' || r.status === 'completed')
      );
    }) || null;
  } catch {
    return null;
  }
}

export function saveIdempotencyRecord(record: IdempotencyRecord): void {
  try {
    const records = getIdempotencyRecords();
    const existingIndex = records.findIndex(r => r.key === record.key);
    
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }
    
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filteredRecords = records.filter(r => 
      new Date(r.createdAt).getTime() > oneHourAgo
    );
    
    localStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(filteredRecords));
  } catch (e) {
    console.error('Failed to save idempotency record:', e);
  }
}

export function updateIdempotencyStatus(key: string, status: IdempotencyRecord['status'], result?: unknown): void {
  try {
    const records = getIdempotencyRecords();
    const record = records.find(r => r.key === key);
    
    if (record) {
      record.status = status;
      if (status === 'completed' || status === 'failed') {
        record.completedAt = new Date().toISOString();
      }
      if (result) {
        record.result = result;
      }
      localStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(records));
    }
  } catch (e) {
    console.error('Failed to update idempotency status:', e);
  }
}

function getIdempotencyRecords(): IdempotencyRecord[] {
  try {
    const data = localStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function clearExpiredIdempotencyRecords(): void {
  try {
    const records = getIdempotencyRecords();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filteredRecords = records.filter(r => 
      new Date(r.createdAt).getTime() > oneHourAgo
    );
    localStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(filteredRecords));
  } catch (e) {
    console.error('Failed to clear expired idempotency records:', e);
  }
}
