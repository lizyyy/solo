import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './data/samples.db';
const uploadPath = process.env.UPLOAD_PATH || './uploads';
const dbDir = path.dirname(dbPath);

export function ensureDirectories(): void {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
}

ensureDirectories();

const db = new sqlite3.Database(dbPath);

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS influencers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          influencerId TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          platform TEXT NOT NULL,
          followers INTEGER DEFAULT 0,
          category TEXT,
          contact TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sampleId TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          brand TEXT NOT NULL,
          category TEXT,
          value REAL DEFAULT 0,
          deposit REAL DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batchId TEXT UNIQUE NOT NULL,
          brand TEXT NOT NULL,
          sendDate TEXT NOT NULL,
          expectedReturnDate TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          handler TEXT,
          remark TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sample_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recordId TEXT UNIQUE NOT NULL,
          batchId TEXT NOT NULL,
          sampleId TEXT NOT NULL,
          sampleName TEXT NOT NULL,
          influencerId TEXT NOT NULL,
          influencerName TEXT NOT NULL,
          sendDate TEXT NOT NULL,
          expectedReturnDate TEXT NOT NULL,
          actualReturnDate TEXT,
          status TEXT DEFAULT 'pending',
          deposit REAL DEFAULT 0,
          deductionAmount REAL,
          deductionReason TEXT,
          photos TEXT,
          handler TEXT,
          remark TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batchId) REFERENCES batches(batchId)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recordId TEXT NOT NULL,
          operation TEXT NOT NULL,
          operator TEXT NOT NULL,
          reason TEXT,
          remark TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_batchId ON sample_records(batchId)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export default db;
