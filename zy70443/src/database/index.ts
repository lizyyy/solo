import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'audit.db');

let db: sqlite3.Database;

export function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
      } else {
        console.log('数据库连接成功');
        try {
          await createTables();
          resolve(db);
        } catch (tableErr) {
          reject(tableErr);
        }
      }
    });
  });
}

function createTables(): Promise<void> {
  return new Promise((resolve, reject) => {
    const tables = [
      `
      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        certificateNo TEXT UNIQUE NOT NULL,
        applicant TEXT NOT NULL,
        issueDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS audit_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT UNIQUE NOT NULL,
        totalCount INTEGER NOT NULL,
        successCount INTEGER NOT NULL DEFAULT 0,
        failedCount INTEGER NOT NULL DEFAULT 0,
        warningCount INTEGER NOT NULL DEFAULT 0,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        executionTimeMs INTEGER NOT NULL,
        status TEXT NOT NULL,
        reportSummary TEXT,
        nextSteps TEXT,
        createdAt TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS audit_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT NOT NULL,
        recordId INTEGER NOT NULL,
        recordType TEXT NOT NULL,
        originalLineNo INTEGER NOT NULL,
        status TEXT NOT NULL,
        errorCode TEXT,
        errorMessage TEXT,
        beforeData TEXT NOT NULL,
        afterData TEXT,
        remarks TEXT,
        executedAt TEXT NOT NULL
      )
      `,
      `
      CREATE TABLE IF NOT EXISTS bus_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT,
        originalLineNo INTEGER NOT NULL,
        employeeName TEXT NOT NULL,
        employeeId TEXT NOT NULL,
        route TEXT NOT NULL,
        bookingDate TEXT NOT NULL,
        manualRemark TEXT,
        createdAt TEXT NOT NULL
      )
      `,
      'CREATE INDEX IF NOT EXISTS idx_audit_results_batchId ON audit_results(batchId)',
      'CREATE INDEX IF NOT EXISTS idx_audit_batches_batchId ON audit_batches(batchId)',
    ];

    let index = 0;
    const createNext = () => {
      if (index >= tables.length) {
        resolve();
        return;
      }
      db.run(tables[index], (err) => {
        if (err) {
          console.error(`创建表 ${index} 失败:`, err.message);
          reject(err);
        } else {
          index++;
          createNext();
        }
      });
    };
    createNext();
  });
}

export function getDb(): sqlite3.Database {
  return db;
}

export function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export { db };
