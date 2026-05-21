import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/sample-chain.db');

let dbInitialized = false;
let dbResolve: (value: boolean) => void;
export const dbReady = new Promise<boolean>((resolve) => {
  dbResolve = resolve;
});

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    dbResolve(false);
  } else {
    console.log('数据库连接成功');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      type TEXT NOT NULL,
      collectionPoint TEXT NOT NULL,
      destinationLab TEXT NOT NULL,
      currentLocation TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      currentHandler TEXT NOT NULL,
      batchId TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      sampleId TEXT NOT NULL,
      fromHandler TEXT NOT NULL,
      toHandler TEXT NOT NULL,
      fromLocation TEXT NOT NULL,
      toLocation TEXT NOT NULL,
      transferTime TEXT NOT NULL,
      temperature REAL,
      humidity REAL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      FOREIGN KEY (sampleId) REFERENCES samples(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batchNumber TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      estimatedArrival TEXT,
      actualArrival TEXT,
      courier TEXT NOT NULL,
      sampleCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS temperatureRecords (
      id TEXT PRIMARY KEY,
      batchId TEXT,
      sampleId TEXT,
      temperature REAL NOT NULL,
      recordTime TEXT NOT NULL,
      location TEXT NOT NULL,
      recordedBy TEXT NOT NULL,
      FOREIGN KEY (batchId) REFERENCES batches(id),
      FOREIGN KEY (sampleId) REFERENCES samples(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exceptionRecords (
      id TEXT PRIMARY KEY,
      sampleId TEXT,
      batchId TEXT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      reportedBy TEXT NOT NULL,
      reportedAt TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolvedAt TEXT,
      resolvedBy TEXT,
      resolution TEXT,
      FOREIGN KEY (sampleId) REFERENCES samples(id),
      FOREIGN KEY (batchId) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS responsibilityLinks (
      id TEXT PRIMARY KEY,
      sampleId TEXT NOT NULL,
      handler TEXT NOT NULL,
      role TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT,
      location TEXT NOT NULL,
      action TEXT NOT NULL,
      FOREIGN KEY (sampleId) REFERENCES samples(id)
    )`, () => {
      console.log('数据表初始化完成');
      dbInitialized = true;
      dbResolve(true);
    });
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function runInsert(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function runGet(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
