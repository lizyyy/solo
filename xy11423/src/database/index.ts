import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'prep-playback.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance: sqlite3.Database | null = null;

export function getDatabase(): sqlite3.Database {
  if (!dbInstance) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      }
    });

    dbInstance.serialize(() => {
      dbInstance!.exec('PRAGMA foreign_keys = ON');
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
      dbInstance!.exec(schema);
    });
  }
  return dbInstance;
}

export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close((err) => {
        if (err) {
          console.error('关闭数据库失败:', err.message);
          reject(err);
        } else {
          dbInstance = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

export async function resetDatabase(): Promise<void> {
  await closeDatabase();
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  await new Promise<void>((resolve, reject) => {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
      } else {
        dbInstance!.serialize(() => {
          dbInstance!.exec('PRAGMA foreign_keys = ON');
          const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
          dbInstance!.exec(schema, (execErr) => {
            if (execErr) {
              console.error('Schema执行失败:', execErr.message);
              reject(execErr);
            } else {
              resolve();
            }
          });
        });
      }
    });
  });
}

export function runSync(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function getSync(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allSync(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function execSync(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function beginTransaction(db: sqlite3.Database): Promise<void> {
  await runSync(db, 'BEGIN');
}

export async function commitTransaction(db: sqlite3.Database): Promise<void> {
  await runSync(db, 'COMMIT');
}

export async function rollbackTransaction(db: sqlite3.Database): Promise<void> {
  await runSync(db, 'ROLLBACK');
}
