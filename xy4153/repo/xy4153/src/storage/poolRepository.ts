import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Pool, User, UserRole } from '../types';

function mapRowToPool(row: any): Pool {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    type: row.type,
    volume: row.volume,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createPool(
  storeId: string,
  name: string,
  type: string,
  volume: number,
  createdBy: User
): Pool {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO pools (id, store_id, name, type, volume, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  insert.run(id, storeId, name, type, volume, now, now);

  return {
    id,
    storeId,
    name,
    type,
    volume,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

export function updatePool(
  id: string,
  updates: Partial<{
    name: string;
    type: string;
    volume: number;
    isActive: boolean;
  }>,
  updatedBy: User
): Pool | null {
  const db = getDatabase();
  const existing = getPoolById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.volume !== undefined) {
    fields.push('volume = ?');
    values.push(updates.volume);
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const update = db.prepare(`
    UPDATE pools SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getPoolById(id);
}

export function getPoolById(id: string): Pool | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM pools WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToPool(row);
}

export function getPoolsByStore(storeId: string): Pool[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM pools WHERE store_id = ? ORDER BY name').all(storeId);
  return rows.map(mapRowToPool);
}

export function getPoolsByUser(user: User): Pool[] {
  const db = getDatabase();
  
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
    const rows = db.prepare(`
      SELECT p.* FROM pools p 
      JOIN stores s ON p.store_id = s.id 
      ORDER BY s.name, p.name
    `).all();
    return rows.map(mapRowToPool);
  }
  
  if (user.storeId) {
    const rows = db.prepare('SELECT * FROM pools WHERE store_id = ? ORDER BY name').all(user.storeId);
    return rows.map(mapRowToPool);
  }
  
  return [];
}

export function deletePool(id: string, deletedBy: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM pools WHERE id = ?').run(id);
  return result.changes > 0;
}
