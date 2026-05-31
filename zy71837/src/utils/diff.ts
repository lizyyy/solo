import type { BattleRecord, DiffResult } from '@/types';
import { generateDataFingerprint } from './fingerprint';

export function compareVersions(oldData: BattleRecord[], newData: BattleRecord[]): DiffResult {
  const oldMap = new Map(oldData.map(r => [r.id, r]));
  const newMap = new Map(newData.map(r => [r.id, r]));
  
  const added: BattleRecord[] = [];
  const removed: BattleRecord[] = [];
  const modified: DiffResult['modified'] = [];
  
  newData.forEach(record => {
    const oldRecord = oldMap.get(record.id);
    if (!oldRecord) {
      added.push(record);
    } else {
      const oldFingerprint = generateDataFingerprint({
        ...oldRecord,
        dataFingerprint: undefined,
        updatedAt: undefined
      });
      const newFingerprint = generateDataFingerprint({
        ...record,
        dataFingerprint: undefined,
        updatedAt: undefined
      });
      
      if (oldFingerprint !== newFingerprint) {
        const changedFields: string[] = [];
        const fields = ['battleId', 'playerId', 'playerName', 'score', 'settlement', 'status', 'battleTime'];
        fields.forEach(field => {
          if (oldRecord[field as keyof BattleRecord] !== record[field as keyof BattleRecord]) {
            changedFields.push(field);
          }
        });
        modified.push({ record, oldRecord, changedFields });
      }
    }
  });
  
  oldData.forEach(record => {
    if (!newMap.has(record.id)) {
      removed.push(record);
    }
  });
  
  return { added, removed, modified };
}

export function diffToText(diff: DiffResult): string {
  const lines: string[] = [];
  
  if (diff.added.length > 0) {
    lines.push(`新增 ${diff.added.length} 条记录:`);
    diff.added.forEach(r => lines.push(`  + ${r.id} - ${r.playerName}`));
  }
  
  if (diff.removed.length > 0) {
    lines.push(`删除 ${diff.removed.length} 条记录:`);
    diff.removed.forEach(r => lines.push(`  - ${r.id} - ${r.playerName}`));
  }
  
  if (diff.modified.length > 0) {
    lines.push(`修改 ${diff.modified.length} 条记录:`);
    diff.modified.forEach(({ record, changedFields }) => {
      lines.push(`  ~ ${record.id} - ${record.playerName}: ${changedFields.join(', ')}`);
    });
  }
  
  if (lines.length === 0) {
    lines.push('无变化');
  }
  
  return lines.join('\n');
}
