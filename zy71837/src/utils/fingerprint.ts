import SHA256 from 'crypto-js/sha256';
import MD5 from 'crypto-js/md5';
import type { FilterConditions, BattleRecord } from '@/types';

export function generateDataFingerprint(data: unknown): string {
  const sortedData = JSON.stringify(data, Object.keys(data as object).sort());
  return SHA256(sortedData).toString().substring(0, 16);
}

export function generateFilterFingerprint(conditions: FilterConditions): string {
  const cleanedConditions: Partial<FilterConditions> = {};
  Object.keys(conditions).forEach(key => {
    const k = key as keyof FilterConditions;
    const value = conditions[k];
    if (value !== undefined && value !== null && 
        (Array.isArray(value) ? value.length > 0 : true)) {
      cleanedConditions[k] = value;
    }
  });
  
  const sorted = JSON.stringify(cleanedConditions, Object.keys(cleanedConditions).sort());
  return MD5(sorted).toString().substring(0, 8);
}

export function generateIdempotencyKey(taskId: string, params: Record<string, unknown>): string {
  const sorted = JSON.stringify({ taskId, params }, Object.keys(params).sort());
  return SHA256(sorted).toString();
}

export function generateRecordFingerprint(record: Omit<BattleRecord, 'dataFingerprint'>): string {
  const { id, battleId, playerId, score, settlement, battleTime } = record;
  const keyData = { id, battleId, playerId, score, settlement, battleTime };
  return generateDataFingerprint(keyData);
}
