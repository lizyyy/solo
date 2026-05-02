import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { User, UserRole } from '../types';

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role as UserRole,
    storeId: row.store_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createUser(
  username: string,
  role: UserRole,
  storeId: string | undefined,
  createdBy: User
): User {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO users (id, username, role, store_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, username, role, storeId || null, now, now);

  return {
    id,
    username,
    role,
    storeId,
    createdAt: now,
    updatedAt: now
  };
}

export function updateUser(
  id: string,
  updates: Partial<{
    username: string;
    role: UserRole;
    storeId: string;
  }>,
  updatedBy: User
): User | null {
  const db = getDatabase();
  const existing = getUserById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }
  if (updates.storeId !== undefined) {
    fields.push('store_id = ?');
    values.push(updates.storeId || null);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const update = db.prepare(`
    UPDATE users SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getUserById(id);
}

export function getUserById(id: string): User | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToUser(row);
}

export function getUserByUsername(username: string): User | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!row) return null;
  return mapRowToUser(row);
}

export function getAllUsers(): User[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM users ORDER BY username').all();
  return rows.map(mapRowToUser);
}

export function getUsersByStore(storeId: string): User[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM users WHERE store_id = ? ORDER BY username').all(storeId);
  return rows.map(mapRowToUser);
}

export function deleteUser(id: string, deletedBy: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}
