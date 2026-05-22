import { getDatabase } from '../database';
import { HistoryRecord, SourceType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as diff from 'diff';

export async function recordHistory(
  sourceType: SourceType,
  sourceId: string,
  action: string,
  beforeData: any,
  afterData: any,
  performedBy: string,
  remark?: string
): Promise<void> {
  const db = await getDatabase();
  
  const beforeStr = beforeData ? JSON.stringify(beforeData, null, 2) : '';
  const afterStr = afterData ? JSON.stringify(afterData, null, 2) : '';
  
  const diffResult = diff.diffJson(beforeData || {}, afterData || {});
  const diffStr = diffResult.map(part => {
    if (part.added) return `+ ${part.value}`;
    if (part.removed) return `- ${part.value}`;
    return `  ${part.value}`;
  }).join('');

  await db.run(`
    INSERT INTO history_records 
    (id, sourceType, sourceId, action, beforeData, afterData, diff, performedBy, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    uuidv4(),
    sourceType,
    sourceId,
    action,
    beforeStr,
    afterStr,
    diffStr,
    performedBy,
    remark
  ]);
}

export async function getHistoryBySource(sourceType: SourceType, sourceId: string): Promise<HistoryRecord[]> {
  const db = await getDatabase();
  return db.all(`
    SELECT * FROM history_records 
    WHERE sourceType = ? AND sourceId = ?
    ORDER BY performedAt DESC
  `, [sourceType, sourceId]) as Promise<HistoryRecord[]>;
}

export async function getAllHistory(limit: number = 100): Promise<HistoryRecord[]> {
  const db = await getDatabase();
  return db.all(`
    SELECT * FROM history_records 
    ORDER BY performedAt DESC
    LIMIT ?
  `, [limit]) as Promise<HistoryRecord[]>;
}

export async function getHistoryByUser(performedBy: string, limit: number = 50): Promise<HistoryRecord[]> {
  const db = await getDatabase();
  return db.all(`
    SELECT * FROM history_records 
    WHERE performedBy = ?
    ORDER BY performedAt DESC
    LIMIT ?
  `, [performedBy, limit]) as Promise<HistoryRecord[]>;
}

export function printHistoryDiff(history: HistoryRecord): void {
  console.log(`\n=== 历史记录: ${history.action} ===`);
  console.log(`时间: ${history.performedAt}`);
  console.log(`操作人: ${history.performedBy}`);
  if (history.remark) {
    console.log(`备注: ${history.remark}`);
  }
  console.log('\n--- 变更差异 ---');
  console.log(history.diff);
  console.log('================\n');
}
