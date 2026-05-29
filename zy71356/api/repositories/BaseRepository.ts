import db from '../db';

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  protected toCamelCase(row: any): T {
    const result: any = {};
    for (const key of Object.keys(row)) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = row[key];
    }
    return result as T;
  }

  protected toSnakeCase(obj: Partial<T>): any {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = key.replace(/([A-Z])/g, (g) => `_${g.toLowerCase()}`);
      result[snakeKey] = (obj as any)[key];
    }
    return result;
  }

  findAll(): T[] {
    const rows = db.prepare(`SELECT * FROM ${this.tableName}`).all();
    return rows.map((row) => this.toCamelCase(row));
  }

  findById(id: string): T | undefined {
    const row = db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(id);
    return row ? this.toCamelCase(row) : undefined;
  }

  delete(id: string): boolean {
    const result = db
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }
}
