import sqlite3 from 'sqlite3';
import path from 'path';

sqlite3.verbose();
export const db = new sqlite3.Database(path.join(process.cwd(), 'inspection.db'));

export function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export interface InspectionRecord {
  id?: number;
  inspectionDate: string;
  inspector: string;
  equipmentName: string;
  location: string;
  status: 'normal' | 'warning' | 'error' | 'critical';
  temperature?: number;
  pressure?: number;
  vibration?: number;
  remarks?: string;
  reviewStatus: 'pending' | 'reviewed' | 'resolved';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SensorAlert {
  id?: number;
  sensorId: string;
  sensorType: string;
  location: string;
  alertLevel: 'info' | 'warning' | 'critical';
  value: number;
  threshold: number;
  alertTime: string;
  isAcknowledged: number;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface ImportError {
  id?: number;
  importType: 'csv' | 'json';
  sourceFile: string;
  rowNumber: number;
  rawData: string;
  errorMessage: string;
  suggestion: string;
  isResolved: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface BatchResult<T> {
  success: T[];
  failed: { rowNumber: number; data: T; error: string; suggestion: string }[];
}

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`PRAGMA journal_mode = WAL`);
      db.run(`PRAGMA foreign_keys = ON`);

      db.run(`
        CREATE TABLE IF NOT EXISTS inspection_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inspectionDate TEXT NOT NULL,
          inspector TEXT NOT NULL,
          equipmentName TEXT NOT NULL,
          location TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('normal', 'warning', 'error', 'critical')),
          temperature REAL,
          pressure REAL,
          vibration REAL,
          remarks TEXT,
          reviewStatus TEXT NOT NULL DEFAULT 'pending' CHECK(reviewStatus IN ('pending', 'reviewed', 'resolved')),
          reviewedBy TEXT,
          reviewedAt TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sensor_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sensorId TEXT NOT NULL,
          sensorType TEXT NOT NULL,
          location TEXT NOT NULL,
          alertLevel TEXT NOT NULL CHECK(alertLevel IN ('info', 'warning', 'critical')),
          value REAL NOT NULL,
          threshold REAL NOT NULL,
          alertTime TEXT NOT NULL,
          isAcknowledged INTEGER NOT NULL DEFAULT 0,
          acknowledgedBy TEXT,
          acknowledgedAt TEXT,
          createdAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS import_errors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          importType TEXT NOT NULL CHECK(importType IN ('csv', 'json')),
          sourceFile TEXT NOT NULL,
          rowNumber INTEGER NOT NULL,
          rawData TEXT NOT NULL,
          errorMessage TEXT NOT NULL,
          suggestion TEXT NOT NULL,
          isResolved INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          resolvedAt TEXT
        )
      `, (err: Error | null) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_date ON inspection_records(inspectionDate)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_status ON inspection_records(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_review_status ON inspection_records(reviewStatus)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_alert_time ON sensor_alerts(alertTime)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_import_errors_resolved ON import_errors(isResolved)`, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
