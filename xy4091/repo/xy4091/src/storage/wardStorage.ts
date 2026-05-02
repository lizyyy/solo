import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from './database';
import { Ward, CreateWardInput, UpdateWardInput } from '../types';

export function createWard(input: CreateWardInput): Ward {
  const now = new Date().toISOString();
  const id = uuidv4();

  const ward: Ward = {
    id,
    name: input.name,
    code: input.code,
    department: input.department,
    floor: input.floor,
    contactPerson: input.contactPerson || null,
    contactPhone: input.contactPhone || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  run(`
    INSERT INTO wards (
      id, name, code, department, floor, contact_person, contact_phone,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    ward.id,
    ward.name,
    ward.code,
    ward.department,
    ward.floor,
    ward.contactPerson,
    ward.contactPhone,
    ward.isActive ? 1 : 0,
    ward.createdAt,
    ward.updatedAt
  ]);

  return ward;
}

export function getWardById(id: string): Ward | null {
  const row = get('SELECT * FROM wards WHERE id = ?', [id]);
  if (!row) return null;
  return mapRowToWard(row);
}

export function getWardByCode(code: string): Ward | null {
  const row = get('SELECT * FROM wards WHERE code = ?', [code]);
  if (!row) return null;
  return mapRowToWard(row);
}

export function getAllWards(includeInactive = false): Ward[] {
  let query = 'SELECT * FROM wards';
  const params: unknown[] = [];

  if (!includeInactive) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY department, name';

  const rows = all(query, params);
  return rows.map((row) => mapRowToWard(row));
}

export function updateWard(id: string, input: UpdateWardInput): Ward | null {
  const existing = getWardById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.code !== undefined) {
    updates.push('code = ?');
    values.push(input.code);
  }
  if (input.department !== undefined) {
    updates.push('department = ?');
    values.push(input.department);
  }
  if (input.floor !== undefined) {
    updates.push('floor = ?');
    values.push(input.floor);
  }
  if (input.contactPerson !== undefined) {
    updates.push('contact_person = ?');
    values.push(input.contactPerson || null);
  }
  if (input.contactPhone !== undefined) {
    updates.push('contact_phone = ?');
    values.push(input.contactPhone || null);
  }
  if (input.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  run(`UPDATE wards SET ${updates.join(', ')} WHERE id = ?`, values);

  return getWardById(id);
}

export function deleteWard(id: string): boolean {
  const result = run('DELETE FROM wards WHERE id = ?', [id]);
  return result.changes > 0;
}

function mapRowToWard(row: Record<string, unknown>): Ward {
  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    department: row.department as string,
    floor: row.floor as number,
    contactPerson: row.contact_person as string | null,
    contactPhone: row.contact_phone as string | null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
