import sqlite3 from 'sqlite3';
import config from '../config.js';

sqlite3.verbose();

let db = null;

export function initDB() {
  return new Promise((resolve, reject) => {
    const dbPath = config.db.path || 'data/deprecation.db';
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        createTables().then(() => resolve(db)).catch(reject);
      }
    });
  });
}

export function getDB() {
  return db;
}

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tax_id TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      raw_input TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      material_type TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      is_abnormal BOOLEAN DEFAULT 0,
      cache_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      raw_input TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS processing_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      conclusion TEXT,
      rerun_marker TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cache_state (
      cache_key TEXT PRIMARY KEY,
      cache_value TEXT NOT NULL,
      version TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_materials_batch ON materials(batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_materials_supplier ON materials(supplier_id)`,
    `CREATE INDEX IF NOT EXISTS idx_records_batch ON processing_records(batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_records_rerun ON processing_records(rerun_marker)`
  ];

  for (const sql of statements) {
    await runAsync(sql);
  }
}

export function closeDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      db = null;
    } else {
      resolve();
    }
  });
}

export function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
