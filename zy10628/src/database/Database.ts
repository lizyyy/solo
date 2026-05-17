import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

export class Database {
  private static instance: sqlite3.Database | null = null;

  static async getInstance(): Promise<sqlite3.Database> {
    if (!Database.instance) {
      const dbPath = path.join(process.cwd(), 'fleet_scheduling.db');
      Database.instance = new sqlite3.Database(dbPath);
      await Database.initialize(Database.instance);
    }
    return Database.instance;
  }

  private static async initialize(db: sqlite3.Database): Promise<void> {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    return new Promise((resolve, reject) => {
      db.exec(schema, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  static get<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  static all<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  static close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (Database.instance) {
        Database.instance.close((err) => {
          if (err) reject(err);
          else {
            Database.instance = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
