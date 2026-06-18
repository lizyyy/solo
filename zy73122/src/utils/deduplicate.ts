import type { BuoyRecord, DeduplicateResult } from '../types';

function getDeduplicateKey(record: BuoyRecord): string {
  const latKey = record.latitude.toFixed(3);
  const lonKey = record.longitude.toFixed(3);
  const timeKey = new Date(record.recordTime).toISOString().slice(0, 10);
  return `${record.buoyId}-${latKey}-${lonKey}-${timeKey}`;
}

export function deduplicateRecords(
  existing: BuoyRecord[],
  incoming: BuoyRecord[],
): { records: BuoyRecord[]; result: DeduplicateResult } {
  const existingMap = new Map<string, BuoyRecord>();
  for (const rec of existing) {
    existingMap.set(getDeduplicateKey(rec), rec);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;

  const resultRecords = [...existing];

  for (const incomingRec of incoming) {
    const key = getDeduplicateKey(incomingRec);
    const existingRec = existingMap.get(key);

    if (!existingRec) {
      resultRecords.push(incomingRec);
      added++;
    } else {
      const hasManualRemark = existingRec.manualRemark && existingRec.manualRemark.trim().length > 0;
      if (hasManualRemark) {
        skipped++;
      } else {
        const idx = resultRecords.findIndex(r => r.id === existingRec.id);
        if (idx !== -1) {
          resultRecords[idx] = {
            ...incomingRec,
            id: existingRec.id,
            manualRemark: existingRec.manualRemark,
            createdAt: existingRec.createdAt,
            updatedAt: new Date().toISOString(),
          };
        }
        updated++;
      }
    }
  }

  return {
    records: resultRecords,
    result: { added, updated, skipped },
  };
}
