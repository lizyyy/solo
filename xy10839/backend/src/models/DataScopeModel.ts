import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { DataScope } from '../types';

export class DataScopeModel {
  static findAll(tenantId?: string): DataScope[] {
    let query = 'SELECT * FROM data_scopes';
    const params: any[] = [];
    if (tenantId) {
      query += ' WHERE tenantId = ?';
      params.push(tenantId);
    }
    query += ' ORDER BY createdAt DESC';
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      ...row,
      dateRange: row.dateRange ? JSON.parse(row.dateRange) : undefined,
      dataTypes: JSON.parse(row.dataTypes),
      filters: row.filters ? JSON.parse(row.filters) : undefined
    }));
  }

  static findById(id: string): DataScope | null {
    const row = db.prepare('SELECT * FROM data_scopes WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      dateRange: row.dateRange ? JSON.parse(row.dateRange) : undefined,
      dataTypes: JSON.parse(row.dataTypes),
      filters: row.filters ? JSON.parse(row.filters) : undefined
    };
  }

  static create(data: Omit<DataScope, 'id' | 'createdAt' | 'updatedAt'>): DataScope {
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO data_scopes (id, tenantId, name, scopeType, dateRange, dataTypes, filters, snapshotVersion, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.tenantId,
      data.name,
      data.scopeType,
      data.dateRange ? JSON.stringify(data.dateRange) : null,
      JSON.stringify(data.dataTypes),
      data.filters ? JSON.stringify(data.filters) : null,
      data.snapshotVersion,
      now,
      now
    );
    return this.findById(id)!;
  }
}
