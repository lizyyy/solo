import type { RawRecord, RecordType, DeduplicateResult, ImportConfig } from '@/types/import';
import { DEFAULT_IMPORT_CONFIG } from '@/types/import';

export function isDuplicate(
  record1: RawRecord,
  record2: RawRecord,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): boolean {
  const timeDiff = Math.abs(record1.timestamp - record2.timestamp);
  if (timeDiff > config.duplicateTimeWindow) return false;

  if (record1.type !== record2.type) return false;

  if (record1.title !== record2.title) return false;

  if (record1.operator !== record2.operator) return false;

  return true;
}

export function getRecordPriority(
  record: RawRecord,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): number {
  let type: RecordType = record.recordType || 'normal';
  if (record.isCorrection) type = 'corrected';

  const priorityIndex = config.priority.indexOf(type);
  return priorityIndex === -1 ? config.priority.length : priorityIndex;
}

export function deduplicateRecords(
  records: RawRecord[],
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): DeduplicateResult[] {
  const results: DeduplicateResult[] = [];
  const processed = new Set<string>();

  const sortedRecords = [...records].sort((a, b) => {
    const priorityA = getRecordPriority(a, config);
    const priorityB = getRecordPriority(b, config);
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.timestamp - b.timestamp;
  });

  for (let i = 0; i < sortedRecords.length; i++) {
    const current = sortedRecords[i];
    if (processed.has(current.id)) continue;

    const duplicates: RawRecord[] = [];

    for (let j = i + 1; j < sortedRecords.length; j++) {
      const other = sortedRecords[j];
      if (processed.has(other.id)) continue;

      if (isDuplicate(current, other, config)) {
        duplicates.push(other);
        processed.add(other.id);
      }
    }

    processed.add(current.id);

    let reason = '正常记录';
    if (current.isCorrection) {
      reason = '人工更正，优先级最高';
    } else if (duplicates.length > 0) {
      reason = `时间戳相近，保留最早/最高优先级记录，移除${duplicates.length}条重复`;
    }

    results.push({
      kept: current,
      duplicates,
      reason
    });
  }

  return results;
}

export function classifyRecordType(
  record: RawRecord,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): RecordType {
  if (record.isCorrection) return 'corrected';
  if (record.recordType) return record.recordType;

  if (record.attachmentDelay && record.attachmentDelay > config.lateThreshold) {
    return 'late';
  }

  return 'normal';
}

export function detectLateArrival(
  record: RawRecord,
  mainEventTime?: number,
  config: ImportConfig = DEFAULT_IMPORT_CONFIG
): boolean {
  if (!mainEventTime) return false;
  return record.timestamp - mainEventTime > config.lateThreshold;
}
