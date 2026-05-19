import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { Tenant } from '../types';

export class TenantModel {
  static findAll(): Tenant[] {
    const rows = db.prepare('SELECT * FROM tenants ORDER BY createdAt DESC').all() as any[];
    return rows.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata)
    }));
  }

  static findById(id: string): Tenant | null {
    const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      metadata: JSON.parse(row.metadata)
    };
  }

  static findByCode(code: string): Tenant | null {
    const row = db.prepare('SELECT * FROM tenants WHERE code = ?').get(code) as any;
    if (!row) return null;
    return {
      ...row,
      metadata: JSON.parse(row.metadata)
    };
  }

  static create(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Tenant {
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO tenants (id, name, code, status, metadata, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.code, data.status, JSON.stringify(data.metadata), now, now);
    return this.findById(id)!;
  }
}
