import { db } from '../db/init';

export abstract class BaseRepository<T> {
  protected abstract tableName: string;
  protected abstract mapRow(row: Record<string, unknown>): T;

  findById(id: string): T | null {
    const row = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findAll(): T[] {
    const rows = db.prepare(`SELECT * FROM ${this.tableName} ORDER BY id DESC`).all() as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }

  findByField(field: string, value: unknown): T[] {
    const rows = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY id DESC`).all(value) as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }
}
