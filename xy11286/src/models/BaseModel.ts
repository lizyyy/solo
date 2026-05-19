import { getDb } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseModel {
  protected abstract tableName: string;

  protected generateId(): string {
    return uuidv4();
  }

  protected get db() {
    return getDb();
  }

  findById<T>(id: string): T | undefined {
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id) as T | undefined;
  }

  findAll<T>(): T[] {
    return this.db.prepare(`SELECT * FROM ${this.tableName}`).all() as T[];
  }

  deleteById(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  count(): number {
    const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as { count: number };
    return result.count;
  }

  exists(id: string): boolean {
    const result = this.db.prepare(`SELECT 1 as exists FROM ${this.tableName} WHERE id = ?`).get(id) as { exists: number } | undefined;
    return result?.exists === 1;
  }
}