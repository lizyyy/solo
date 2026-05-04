import { db } from '../database/connection';
import { generateId } from '../utils/date';

export interface BaseRepository<T> {
  create(data: Partial<T>): T;
  update(id: string, data: Partial<T>): T | undefined;
  findById(id: string): T | undefined;
  findAll(): T[];
  delete(id: string): boolean;
}

export class Repository<T extends { id: string; created_at: string; updated_at: string }> 
  implements BaseRepository<T> {
  constructor(protected tableName: string) {}

  create(data: Partial<T>): T {
    const id = generateId();
    const now = new Date().toISOString();
    const insertData = {
      id,
      created_at: now,
      updated_at: now,
      ...data,
    } as T;

    const keys = Object.keys(insertData);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => insertData[k as keyof T]);

    const stmt = db.prepare(
      `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`
    );
    stmt.run(values);

    return this.findById(id)!;
  }

  update(id: string, data: Partial<T>): T | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const now = new Date().toISOString();
    const updateData = { ...data, updated_at: now } as Partial<T>;
    const keys = Object.keys(updateData);
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => updateData[k as keyof T]), id];

    const stmt = db.prepare(
      `UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?`
    );
    stmt.run(values);

    return this.findById(id);
  }

  findById(id: string): T | undefined {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    return stmt.get(id) as T | undefined;
  }

  findAll(): T[] {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`);
    return stmt.all() as T[];
  }

  delete(id: string): boolean {
    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  findByField(field: keyof T, value: unknown): T[] {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${String(field)} = ?`);
    return stmt.all(value) as T[];
  }

  findOneByField(field: keyof T, value: unknown): T | undefined {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${String(field)} = ? LIMIT 1`);
    return stmt.get(value) as T | undefined;
  }
}
