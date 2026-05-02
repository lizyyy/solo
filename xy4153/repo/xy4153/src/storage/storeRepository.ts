import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Store, User, UserRole } from '../types';

function mapRowToStore(row: any): Store {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createStore(
  name: string,
  address: string,
  contactPerson: string,
  contactPhone: string,
  createdBy: User
): Store {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO stores (id, name, address, contact_person, contact_phone, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  insert.run(id, name, address, contactPerson, contactPhone, now, now);

  return {
    id,
    name,
    address,
    contactPerson,
    contactPhone,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

export function updateStore(
  id: string,
  updates: Partial<{
    name: string;
    address: string;
    contactPerson: string;
    contactPhone: string;
    isActive: boolean;
  }>,
  updatedBy: User
): Store | null {
  const db = getDatabase();
  const existing = getStoreById(id);
  
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.address !== undefined) {
    fields.push('address = ?');
    values.push(updates.address);
  }
  if (updates.contactPerson !== undefined) {
    fields.push('contact_person = ?');
    values.push(updates.contactPerson);
  }
  if (updates.contactPhone !== undefined) {
    fields.push('contact_phone = ?');
    values.push(updates.contactPhone);
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
    UPDATE stores SET ${fields.join(', ')} WHERE id = ?
  `);

  update.run(...values);

  return getStoreById(id);
}

export function getStoreById(id: string): Store | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  
  if (!row) return null;
  return mapRowToStore(row);
}

export function getStoresByUser(user: User): Store[] {
  const db = getDatabase();
  
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
    const rows = db.prepare('SELECT * FROM stores ORDER BY name').all();
    return rows.map(mapRowToStore);
  }
  
  if (user.storeId) {
    const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(user.storeId);
    return row ? [mapRowToStore(row)] : [];
  }
  
  return [];
}

export function getAllStores(): Store[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM stores ORDER BY name').all();
  return rows.map(mapRowToStore);
}

export function deleteStore(id: string, deletedBy: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM stores WHERE id = ?').run(id);
  return result.changes > 0;
}
