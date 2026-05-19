import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

let db: sqlite3.Database | null = null;

export async function getDb(): Promise<sqlite3.Database> {
  if (!db) {
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'inventory.db');
    db = new sqlite3.Database(dbPath);
  }
  return db;
}

export function runQuery(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise(async (resolve, reject) => {
    const db = await getDb();
    db.run(sql, params, function (err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise(async (resolve, reject) => {
    const db = await getDb();
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    const db = await getDb();
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function beginTransaction(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await getDb();
    db.run('BEGIN TRANSACTION', (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function commitTransaction(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await getDb();
    db.run('COMMIT', (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function rollbackTransaction(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await getDb();
    db.run('ROLLBACK', (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}