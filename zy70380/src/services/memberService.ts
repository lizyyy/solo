import { v4 as uuidv4 } from 'uuid';
import { Member } from '../types';
import { getDbOne, getDbAll, runDb } from '../database';

function dbRowToMember(row: any): Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    points: row.points,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getMemberById(id: string): Promise<Member | undefined> {
  const row = await getDbOne('SELECT * FROM members WHERE id = ?', [id]);
  return row ? dbRowToMember(row) : undefined;
}

export async function getMemberByPhone(phone: string): Promise<Member | undefined> {
  const row = await getDbOne('SELECT * FROM members WHERE phone = ?', [phone]);
  return row ? dbRowToMember(row) : undefined;
}

export async function createMember(name: string, phone: string): Promise<Member> {
  const now = new Date().toISOString();
  const id = uuidv4();
  
  await runDb(
    'INSERT INTO members (id, name, phone, points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, phone, 0, now, now]
  );
  
  const member = await getMemberById(id);
  if (!member) {
    throw new Error('Failed to create member');
  }
  return member;
}

export async function updateMemberPoints(memberId: string, points: number): Promise<void> {
  const now = new Date().toISOString();
  await runDb(
    'UPDATE members SET points = ?, updated_at = ? WHERE id = ?',
    [points, now, memberId]
  );
}

export async function addMemberPoints(memberId: string, pointsToAdd: number): Promise<void> {
  const member = await getMemberById(memberId);
  if (!member) {
    throw new Error('Member not found');
  }
  const newPoints = member.points + pointsToAdd;
  await updateMemberPoints(memberId, newPoints);
}

export async function deductMemberPoints(memberId: string, pointsToDeduct: number): Promise<void> {
  const member = await getMemberById(memberId);
  if (!member) {
    throw new Error('Member not found');
  }
  if (member.points < pointsToDeduct) {
    throw new Error('Insufficient points');
  }
  const newPoints = member.points - pointsToDeduct;
  await updateMemberPoints(memberId, newPoints);
}

export async function getAllMembers(): Promise<Member[]> {
  const rows = await getDbAll('SELECT * FROM members');
  return rows.map(dbRowToMember);
}
