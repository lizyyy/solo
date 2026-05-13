import { v4 as uuidv4 } from 'uuid';
import { Redemption } from '../types';
import { getDbOne, getDbAll, runDb } from '../database';
import { createPointLog } from './pointLogService';

function dbRowToRedemption(row: any): Redemption {
  return {
    id: row.id,
    memberId: row.member_id,
    points: row.points,
    giftName: row.gift_name,
    giftId: row.gift_id,
    status: row.status,
    createdAt: row.created_at
  };
}

export async function getRedemptionById(id: string): Promise<Redemption | undefined> {
  const row = await getDbOne('SELECT * FROM redemptions WHERE id = ?', [id]);
  return row ? dbRowToRedemption(row) : undefined;
}

export async function getRedemptionsByMemberId(memberId: string): Promise<Redemption[]> {
  const rows = await getDbAll('SELECT * FROM redemptions WHERE member_id = ? ORDER BY created_at DESC', [memberId]);
  return rows.map(dbRowToRedemption);
}

export async function getConfirmedRedemptionsByMemberId(memberId: string): Promise<Redemption[]> {
  const rows = await getDbAll(
    'SELECT * FROM redemptions WHERE member_id = ? AND status = ? ORDER BY created_at DESC',
    [memberId, 'confirmed']
  );
  return rows.map(dbRowToRedemption);
}

export async function getTotalLockedPoints(memberId: string): Promise<number> {
  const row = await getDbOne(
    'SELECT COALESCE(SUM(points), 0) as total FROM redemptions WHERE member_id = ? AND status = ?',
    [memberId, 'confirmed']
  );
  return (row as any)?.total || 0;
}

export async function createRedemption(
  memberId: string,
  points: number,
  giftName: string,
  giftId: string
): Promise<Redemption> {
  const now = new Date().toISOString();
  const id = uuidv4();
  
  await runDb(
    `INSERT INTO redemptions (id, member_id, points, gift_name, gift_id, status, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, memberId, points, giftName, giftId, 'pending', now]
  );
  
  const redemption = await getRedemptionById(id);
  if (!redemption) {
    throw new Error('Failed to create redemption');
  }
  return redemption;
}

export async function confirmRedemption(id: string): Promise<void> {
  const redemption = await getRedemptionById(id);
  if (!redemption) {
    throw new Error('Redemption not found');
  }
  
  const now = new Date().toISOString();
  await runDb('UPDATE redemptions SET status = ? WHERE id = ?', ['confirmed', id]);
  
  await createPointLog(
    redemption.memberId,
    redemption.points,
    'spend',
    `兑换礼品: ${redemption.giftName}`,
    { redemptionId: id }
  );
}

export async function cancelRedemption(id: string): Promise<void> {
  const now = new Date().toISOString();
  await runDb('UPDATE redemptions SET status = ? WHERE id = ?', ['cancelled', id]);
}
