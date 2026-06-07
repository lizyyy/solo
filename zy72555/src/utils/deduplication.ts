import type { TrainingLog, ImportReport } from '@/types';

export function buildDedupeKey(fileHash: string, lineNumber: number): string {
  return `${fileHash}:${lineNumber}`;
}

export function buildLogDedupeKey(log: TrainingLog): string {
  return buildDedupeKey(log.fileHash, log.originalLineNumber);
}

export function deduplicateLogs(
  newLogs: TrainingLog[],
  existingLogs: TrainingLog[]
): { newEntries: TrainingLog[]; report: ImportReport } {
  const existingKeys = new Set(existingLogs.map(buildLogDedupeKey));
  const newEntries: TrainingLog[] = [];
  let boundaryCases = 0;

  for (const log of newLogs) {
    const key = buildLogDedupeKey(log);
    if (!existingKeys.has(key)) {
      newEntries.push(log);
      existingKeys.add(key);
      if (log.isBoundaryCase) {
        boundaryCases++;
      }
    }
  }

  const report: ImportReport = {
    totalRows: newLogs.length,
    newRows: newEntries.length,
    duplicateRows: newLogs.length - newEntries.length,
    skippedRows: 0,
    boundaryCases,
  };

  return { newEntries, report };
}
