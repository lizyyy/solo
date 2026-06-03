import type * as T from '@/types';

function padZero(num: number, length: number = 2): string {
  return num.toString().padStart(length, '0');
}

export function generateImportBatch(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = padZero(now.getMonth() + 1);
  const day = padZero(now.getDate());
  const hours = padZero(now.getHours());
  const minutes = padZero(now.getMinutes());
  const seconds = padZero(now.getSeconds());
  return `IMP-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function checkDuplicates(
  incoming: T.RangefinderRecord[],
  existing: T.RangefinderRecord[]
): T.DuplicateCheckResult {
  const existingKeys = new Set(
    existing.map((r) => `${r.batchNo}-${r.pointX}-${r.pointY}`)
  );

  const newRecords: T.RangefinderRecord[] = [];
  const duplicateRecords: T.RangefinderRecord[] = [];

  for (const record of incoming) {
    const key = `${record.batchNo}-${record.pointX}-${record.pointY}`;
    if (existingKeys.has(key)) {
      duplicateRecords.push(record);
    } else {
      newRecords.push(record);
      existingKeys.add(key);
    }
  }

  return {
    newRecords,
    duplicateRecords,
    skippedCount: duplicateRecords.length,
    addedCount: newRecords.length,
  };
}
