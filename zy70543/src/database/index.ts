import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'callback_contract.db');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        sign_algorithm TEXT NOT NULL DEFAULT 'RSA256',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS contract_versions (
        id TEXT PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        version TEXT NOT NULL,
        callback_url TEXT NOT NULL,
        expected_fields TEXT NOT NULL,
        sign_header_name TEXT NOT NULL DEFAULT 'X-Signature',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        UNIQUE(supplier_id, version)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS callback_samples (
        id TEXT PRIMARY KEY,
        contract_version_id TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        raw_request TEXT NOT NULL,
        headers TEXT NOT NULL,
        body TEXT NOT NULL,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contract_version_id) REFERENCES contract_versions(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sign_headers (
        id TEXT PRIMARY KEY,
        callback_sample_id TEXT NOT NULL,
        header_name TEXT NOT NULL,
        header_value TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (callback_sample_id) REFERENCES callback_samples(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS field_diffs (
        id TEXT PRIMARY KEY,
        callback_sample_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        expected TEXT,
        actual TEXT,
        diff_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        FOREIGN KEY (callback_sample_id) REFERENCES callback_samples(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS verification_conclusions (
        id TEXT PRIMARY KEY,
        callback_sample_id TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        contract_version_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        sign_result TEXT NOT NULL,
        field_result TEXT NOT NULL,
        overall_result TEXT NOT NULL,
        raw_input TEXT NOT NULL,
        processing_basis TEXT NOT NULL,
        final_conclusion TEXT NOT NULL,
        error_message TEXT,
        verified_by TEXT,
        verified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (callback_sample_id) REFERENCES callback_samples(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (contract_version_id) REFERENCES contract_versions(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        conclusion_id TEXT NOT NULL,
        action TEXT NOT NULL,
        operator TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conclusion_id) REFERENCES verification_conclusions(id)
      )
    `);

    console.log('数据表初始化完成');
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function getOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}
