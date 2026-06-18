import type { BuoyLog, ImportResult } from '../types';
import { detectBoundarySample } from './boundaryDetector';
import { calculateAffectedArea } from './geoCalculator';

export function deduplicateLogs(
  newLogs: BuoyLog[],
  existingLogs: BuoyLog[]
): {
  toAdd: BuoyLog[];
  toUpdate: BuoyLog[];
  duplicates: number;
} {
  const existingMap = new Map(
    existingLogs.map((log) => [`${log.buoyId}-${log.timestamp}`, log])
  );

  const toAdd: BuoyLog[] = [];
  const toUpdate: BuoyLog[] = [];
  let duplicates = 0;

  for (const newLog of newLogs) {
    const key = `${newLog.buoyId}-${newLog.timestamp}`;
    const existing = existingMap.get(key);

    if (existing) {
      duplicates++;
      toUpdate.push({
        ...newLog,
        id: existing.id,
        remark: existing.remark,
        anomalies: existing.anomalies.length > 0 ? existing.anomalies : newLog.anomalies,
      });
    } else {
      toAdd.push(newLog);
    }
  }

  return { toAdd, toUpdate, duplicates };
}

export function processImportLogs(
  newLogs: BuoyLog[],
  existingLogs: BuoyLog[]
): {
  processedLogs: BuoyLog[];
  total: number;
  added: number;
  duplicates: number;
  preservedRemarks: number;
} {
  const { toAdd, toUpdate, duplicates } = deduplicateLogs(newLogs, existingLogs);

  const processedLogs: BuoyLog[] = [];
  let preservedRemarks = 0;

  for (const log of toAdd) {
    try {
      const isBoundary = detectBoundarySample(log);
      const processedLog: BuoyLog = {
        ...log,
        isBoundarySample: isBoundary,
        affectedArea: log.affectedArea || calculateAffectedArea(log),
      };

      processedLogs.push(processedLog);
    } catch (e) {
      console.error(`处理日志 ${log.buoyId}-${log.timestamp} 时出错:`, e);
    }
  }

  for (const log of toUpdate) {
    try {
      const isBoundary = detectBoundarySample(log);
      const processedLog: BuoyLog = {
        ...log,
        isBoundarySample: isBoundary,
        affectedArea: log.affectedArea || calculateAffectedArea(log),
      };

      if (log.remark) {
        preservedRemarks++;
      }

      processedLogs.push(processedLog);
    } catch (e) {
      console.error(`更新日志 ${log.buoyId}-${log.timestamp} 时出错:`, e);
    }
  }

  return {
    processedLogs,
    total: newLogs.length,
    added: toAdd.length,
    duplicates,
    preservedRemarks,
  };
}

export function generateLogKey(log: BuoyLog): string {
  return `${log.buoyId}-${log.timestamp}`;
}

export function findDuplicateLogs(
  logs: BuoyLog[]
): Map<string, BuoyLog[]> {
  const groups = new Map<string, BuoyLog[]>();

  for (const log of logs) {
    const key = generateLogKey(log);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(log);
  }

  for (const [key, group] of groups) {
    if (group.length <= 1) {
      groups.delete(key);
    }
  }

  return groups;
}

export function mergeLogWithRemark(
  newLog: BuoyLog,
  existingLog: BuoyLog
): BuoyLog {
  return {
    ...newLog,
    id: existingLog.id,
    remark: existingLog.remark,
    anomalies: existingLog.anomalies.length > 0 ? existingLog.anomalies : newLog.anomalies,
  };
}
