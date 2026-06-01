import type { GameRecord, DataFlag, GameConfig } from '../types';
import { generateId, formatTimestamp } from '../utils/timeUtils';
import { OPERATOR } from '../config/gameConfig';

export function detectEmpty(value: any): boolean {
  return value === null || value === undefined || value === '' || 
         (typeof value === 'number' && isNaN(value));
}

export function detectDuplicate(
  currentValue: number, 
  records: GameRecord[], 
  windowMs: number
): { isDuplicate: boolean; duplicateOf: string | null } {
  const now = Date.now();
  const recentRecords = records.filter(
    r => now - r.timestamp < windowMs && r.processedValue === currentValue
  );
  if (recentRecords.length > 0) {
    return { isDuplicate: true, duplicateOf: recentRecords[0].id };
  }
  return { isDuplicate: false, duplicateOf: null };
}

export function detectBoundary(
  value: number, 
  target: number, 
  thresholdPercent: number
): boolean {
  if (target <= 0) return false;
  const diff = Math.abs(value - target);
  const percent = (diff / target) * 100;
  return percent <= thresholdPercent;
}

export function detectMisoperation(
  currentTime: number, 
  lastInputTime: number | null, 
  thresholdMs: number
): boolean {
  if (!lastInputTime) return false;
  return currentTime - lastInputTime < thresholdMs;
}

export function processValue(rawValue: string | number | null): number | null {
  if (detectEmpty(rawValue)) {
    return null;
  }
  
  if (typeof rawValue === 'number') {
    return rawValue;
  }
  
  const cleaned = String(rawValue).trim();
  if (cleaned === '') {
    return null;
  }
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    return null;
  }
  
  return parsed;
}

export interface ProcessResult {
  record: GameRecord;
  duplicateInfo: { isDuplicate: boolean; duplicateOf: string | null };
}

export function processInput(
  rawValue: string | number | null,
  note: string,
  config: GameConfig,
  records: GameRecord[],
  lastInputTime: number | null,
  roundNumber: number,
  currentLoad: number,
  responseTime: number | null,
  source: 'manual' | 'import' | 'test' = 'manual'
): ProcessResult {
  const timestamp = Date.now();
  const processedValue = processValue(rawValue);
  const flags: DataFlag[] = [];
  const processingNotes: string[] = [];

  if (detectEmpty(rawValue)) {
    flags.push('empty');
    processingNotes.push('原始值为空，已标记但保留原始位置');
  }

  if (processedValue !== null) {
    const dupResult = detectDuplicate(processedValue, records, config.duplicateWindow);
    if (dupResult.isDuplicate && dupResult.duplicateOf) {
      flags.push('duplicate');
      const dupRecord = records.find(r => r.id === dupResult.duplicateOf);
      processingNotes.push(`与记录#${dupRecord?.sequence ?? '未知'}重复，时间窗口${config.duplicateWindow}ms内`);
    }

    if (detectBoundary(processedValue, config.targetLoad, config.boundaryThreshold)) {
      flags.push('boundary');
      const diff = Math.abs(processedValue - config.targetLoad);
      const percent = ((diff / config.targetLoad) * 100).toFixed(2);
      processingNotes.push(`边界值记录，与目标差值${diff}(${percent}%)，阈值${config.boundaryThreshold}%`);
    }

    if (detectMisoperation(timestamp, lastInputTime, config.misoperationThreshold)) {
      flags.push('misoperation');
      const timeDiff = timestamp - (lastInputTime || 0);
      processingNotes.push(`疑似误操作，距上次输入仅${timeDiff}ms，阈值${config.misoperationThreshold}ms`);
    }
  }

  if (flags.length === 0) {
    flags.push('normal');
  }

  const newLoad = currentLoad + config.loadPerRound;
  const isSuccess = processedValue !== null && processedValue <= config.maxLoad;

  const record: GameRecord = {
    id: generateId(),
    sequence: records.length + 1,
    timestamp,
    formattedTime: formatTimestamp(timestamp),
    source,
    rawValue,
    processedValue,
    load: newLoad,
    note: note || '',
    flags,
    isSuccess,
    failureReason: null,
    failureDetail: '',
    processingNote: processingNotes.join('；'),
    operator: OPERATOR,
    responseTime,
    roundNumber,
  };

  const finalDupResult = processedValue !== null 
    ? detectDuplicate(processedValue, records, config.duplicateWindow)
    : { isDuplicate: false, duplicateOf: null };

  return {
    record,
    duplicateInfo: finalDupResult,
  };
}
