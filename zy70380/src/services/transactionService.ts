import { v4 as uuidv4 } from 'uuid';
import { Transaction } from '../types';
import { getDbOne, getDbAll, runDb } from '../database';

function dbRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    memberId: row.member_id,
    amount: row.amount,
    category: row.category,
    createdAt: row.created_at
  };
}

export async function getTransactionById(id: string): Promise<Transaction | undefined> {
  const row = await getDbOne('SELECT * FROM transactions WHERE id = ?', [id]);
  return row ? dbRowToTransaction(row) : undefined;
}

export async function getTransactionsByMemberId(
  memberId: string,
  startTime?: string,
  endTime?: string
): Promise<Transaction[]> {
  let sql = 'SELECT * FROM transactions WHERE member_id = ?';
  const params: any[] = [memberId];
  
  if (startTime) {
    sql += ' AND created_at >= ?';
    params.push(startTime);
  }
  if (endTime) {
    sql += ' AND created_at <= ?';
    params.push(endTime);
  }
  
  sql += ' ORDER BY created_at ASC';
  
  const rows = await getDbAll(sql, params);
  return rows.map(dbRowToTransaction);
}

export async function createTransaction(
  memberId: string,
  amount: number,
  category: string,
  createdAt?: string
): Promise<Transaction> {
  const now = createdAt || new Date().toISOString();
  const id = uuidv4();
  
  await runDb(
    'INSERT INTO transactions (id, member_id, amount, category, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, memberId, amount, category, now]
  );
  
  const transaction = await getTransactionById(id);
  if (!transaction) {
    throw new Error('Failed to create transaction');
  }
  return transaction;
}
