import { v4 as uuidv4 } from 'uuid';
import { PointLog } from '../types';
import { getDbOne, getDbAll, runDb } from '../database';
import { addMemberPoints, deductMemberPoints } from './memberService';

function dbRowToPointLog(row: any): PointLog {
  return {
    id: row.id,
    memberId: row.member_id,
    amount: row.amount,
    type: row.type,
    transactionId: row.transaction_id,
    redemptionId: row.redemption_id,
    recalculationTaskId: row.recalculation_task_id,
    description: row.description,
    createdAt: row.created_at
  };
}

export async function getPointLogById(id: string): Promise<PointLog | undefined> {
  const row = await getDbOne('SELECT * FROM point_logs WHERE id = ?', [id]);
  return row ? dbRowToPointLog(row) : undefined;
}

export async function getPointLogsByMemberId(memberId: string): Promise<PointLog[]> {
  const rows = await getDbAll('SELECT * FROM point_logs WHERE member_id = ? ORDER BY created_at DESC', [memberId]);
  return rows.map(dbRowToPointLog);
}

export async function getPointLogsByTransactionId(transactionId: string): Promise<PointLog[]> {
  const rows = await getDbAll('SELECT * FROM point_logs WHERE transaction_id = ?', [transactionId]);
  return rows.map(dbRowToPointLog);
}

export async function createPointLog(
  memberId: string,
  amount: number,
  type: PointLog['type'],
  description: string,
  options?: {
    transactionId?: string;
    redemptionId?: string;
    recalculationTaskId?: string;
  }
): Promise<PointLog> {
  const now = new Date().toISOString();
  const id = uuidv4();
  
  await runDb(
    `INSERT INTO point_logs 
     (id, member_id, amount, type, transaction_id, redemption_id, recalculation_task_id, description, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      memberId,
      amount,
      type,
      options?.transactionId || null,
      options?.redemptionId || null,
      options?.recalculationTaskId || null,
      description,
      now
    ]
  );
  
  if (type === 'earn' || type === 'compensation') {
    await addMemberPoints(memberId, amount);
  } else if (type === 'spend' || type === 'adjustment') {
    await deductMemberPoints(memberId, Math.abs(amount));
  }
  
  const pointLog = await getPointLogById(id);
  if (!pointLog) {
    throw new Error('Failed to create point log');
  }
  return pointLog;
}

export async function getEarnedPointsByMemberId(memberId: string): Promise<number> {
  const row = await getDbOne(
    'SELECT COALESCE(SUM(amount), 0) as total FROM point_logs WHERE member_id = ? AND type = ?',
    [memberId, 'earn']
  );
  return (row as any)?.total || 0;
}
