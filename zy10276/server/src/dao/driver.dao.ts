import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phone?: string;
  totalPoints: number;
  remainingPoints: number;
  createdAt: string;
  updatedAt: string;
}

export class DriverDAO {
  static getAll(): Driver[] {
    const stmt = db.prepare(`
      SELECT 
        id, name, license_number as licenseNumber, phone,
        total_points as totalPoints, remaining_points as remainingPoints,
        created_at as createdAt, updated_at as updatedAt
      FROM drivers
      ORDER BY created_at DESC
    `);
    return stmt.all() as Driver[];
  }

  static getById(id: string): Driver | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, name, license_number as licenseNumber, phone,
        total_points as totalPoints, remaining_points as remainingPoints,
        created_at as createdAt, updated_at as updatedAt
      FROM drivers WHERE id = ?
    `);
    return stmt.get(id) as Driver | undefined;
  }

  static create(data: Omit<Driver, 'id' | 'totalPoints' | 'remainingPoints' | 'createdAt' | 'updatedAt'>): Driver {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO drivers (id, name, license_number, phone, total_points, remaining_points, created_at, updated_at)
      VALUES (?, ?, ?, ?, 12, 12, ?, ?)
    `);
    stmt.run(id, data.name, data.licenseNumber, data.phone || null, now, now);
    return this.getById(id)!;
  }

  static update(id: string, data: Partial<Omit<Driver, 'id' | 'createdAt'>>): Driver | null {
    const driver = this.getById(id);
    if (!driver) return null;

    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.licenseNumber !== undefined) { updates.push('license_number = ?'); values.push(data.licenseNumber); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.remainingPoints !== undefined) { updates.push('remaining_points = ?'); values.push(data.remainingPoints); }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    
    return this.getById(id) || null;
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM drivers WHERE id = ?');
    const result = stmt.run(id);
    return (result.changes || 0) > 0;
  }
}

export default DriverDAO;
