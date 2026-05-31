import type { BattleRecord, FilterConditions } from '@/types';
import { generateRecordFingerprint } from './fingerprint';

export interface ImportResult {
  success: boolean;
  records: BattleRecord[];
  duplicates: {
    existing: BattleRecord;
    incoming: BattleRecord;
    resolution: 'skip' | 'overwrite' | 'keep_both' | 'pending';
  }[];
  errors: string[];
}

export interface ImportOptions {
  handleDuplicates: 'skip' | 'overwrite' | 'keep_both' | 'ask';
  existingRecords: BattleRecord[];
}

export function parseCSV(content: string): Omit<BattleRecord, 'id' | 'dataFingerprint' | 'createdAt' | 'updatedAt'>[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const requiredHeaders = ['battleId', 'playerId', 'playerName', 'score', 'settlement', 'battleTime'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    throw new Error(`CSV缺少必要列: ${missingHeaders.join(', ')}`);
  }
  
  const records: Omit<BattleRecord, 'id' | 'dataFingerprint' | 'createdAt' | 'updatedAt'>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      throw new Error(`第 ${i + 1} 行列数不匹配`);
    }
    
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx].trim();
    });
    
    const score = parseFloat(record.score);
    const settlement = parseFloat(record.settlement);
    
    if (isNaN(score) || isNaN(settlement)) {
      throw new Error(`第 ${i + 1} 行分数或结算值不是有效数字`);
    }
    
    records.push({
      battleId: record.battleId,
      playerId: record.playerId,
      playerName: record.playerName,
      score,
      settlement,
      status: 'normal',
      battleTime: record.battleTime
    });
  }
  
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

export function processImport(
  incomingRecords: Omit<BattleRecord, 'id' | 'dataFingerprint' | 'createdAt' | 'updatedAt'>[],
  options: ImportOptions
): ImportResult {
  const { handleDuplicates, existingRecords } = options;
  
  const result: ImportResult = {
    success: true,
    records: [],
    duplicates: [],
    errors: []
  };
  
  const existingBattleIds = new Map(existingRecords.map(r => [r.battleId, r]));
  const existingPlayerIds = new Map(existingRecords.map(r => [r.playerId, r]));
  
  incomingRecords.forEach((incoming, idx) => {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const recordWithMeta: BattleRecord = {
        ...incoming,
        id,
        dataFingerprint: '',
        createdAt: now,
        updatedAt: now
      };
      
      recordWithMeta.dataFingerprint = generateRecordFingerprint(recordWithMeta);
      
      const existingByBattle = existingBattleIds.get(incoming.battleId);
      const existingByPlayer = existingPlayerIds.get(incoming.playerId);
      const existing = existingByBattle || existingByPlayer;
      
      if (existing) {
        const existingFp = generateRecordFingerprint(existing);
        const incomingFp = recordWithMeta.dataFingerprint;
        
        if (existingFp === incomingFp) {
          result.duplicates.push({
            existing,
            incoming: recordWithMeta,
            resolution: 'skip'
          });
          return;
        }
        
        if (handleDuplicates === 'skip') {
          result.duplicates.push({
            existing,
            incoming: recordWithMeta,
            resolution: 'skip'
          });
        } else if (handleDuplicates === 'overwrite') {
          recordWithMeta.id = existing.id;
          recordWithMeta.createdAt = existing.createdAt;
          result.records.push(recordWithMeta);
          result.duplicates.push({
            existing,
            incoming: recordWithMeta,
            resolution: 'overwrite'
          });
        } else if (handleDuplicates === 'keep_both') {
          result.records.push(recordWithMeta);
          result.duplicates.push({
            existing,
            incoming: recordWithMeta,
            resolution: 'keep_both'
          });
        } else {
          result.duplicates.push({
            existing,
            incoming: recordWithMeta,
            resolution: 'pending'
          });
        }
      } else {
        result.records.push(recordWithMeta);
      }
    } catch (error) {
      result.errors.push(`第 ${idx + 2} 行处理失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  return result;
}

export function detectDuplicates(
  incoming: BattleRecord[],
  existing: BattleRecord[]
): { existing: BattleRecord; incoming: BattleRecord }[] {
  const existingMap = new Map(existing.map(r => [r.battleId, r]));
  const duplicates: { existing: BattleRecord; incoming: BattleRecord }[] = [];
  
  incoming.forEach(record => {
    const match = existingMap.get(record.battleId);
    if (match) {
      duplicates.push({ existing: match, incoming: record });
    }
  });
  
  return duplicates;
}

export function applyFilter(records: BattleRecord[], conditions: FilterConditions): BattleRecord[] {
  return records.filter(record => {
    if (conditions.battleId && !record.battleId.includes(conditions.battleId)) {
      return false;
    }
    if (conditions.playerId && !record.playerId.includes(conditions.playerId)) {
      return false;
    }
    if (conditions.playerName && !record.playerName.includes(conditions.playerName)) {
      return false;
    }
    if (conditions.status && conditions.status.length > 0 && !conditions.status.includes(record.status)) {
      return false;
    }
    if (conditions.battleTimeRange) {
      const [start, end] = conditions.battleTimeRange;
      if (start && record.battleTime < start) return false;
      if (end && record.battleTime > end) return false;
    }
    if (conditions.scoreRange) {
      const [min, max] = conditions.scoreRange;
      if (min !== undefined && record.score < min) return false;
      if (max !== undefined && record.score > max) return false;
    }
    if (conditions.settlementRange) {
      const [min, max] = conditions.settlementRange;
      if (min !== undefined && record.settlement < min) return false;
      if (max !== undefined && record.settlement > max) return false;
    }
    return true;
  });
}
