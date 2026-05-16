import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'org-sync.db');

let db: sqlite3.Database;

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      createTables()
        .then(() => resolve())
        .catch(reject);
    });
  });
}

function createTables(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_batches (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          total_nodes INTEGER NOT NULL DEFAULT 0,
          valid_nodes INTEGER NOT NULL DEFAULT 0,
          invalid_nodes INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          raw_input TEXT NOT NULL,
          validation_report TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,
          created_by TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS department_nodes (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          dept_id TEXT NOT NULL,
          dept_name TEXT NOT NULL,
          parent_dept_id TEXT,
          level INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          raw_data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(batch_id, dept_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS department_relations (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          ancestor_dept_id TEXT NOT NULL,
          descendant_dept_id TEXT NOT NULL,
          distance INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(batch_id, ancestor_dept_id, descendant_dept_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS consumer_systems (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          callback_url TEXT,
          created_at INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS consumer_progress (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          consumer_id TEXT NOT NULL,
          status TEXT NOT NULL,
          consumed_count INTEGER NOT NULL DEFAULT 0,
          last_consumed_node_id TEXT,
          error_message TEXT,
          ack_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(batch_id, consumer_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS exception_nodes (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          node_id TEXT NOT NULL,
          dept_id TEXT NOT NULL,
          error_type TEXT NOT NULL,
          error_message TEXT NOT NULL,
          raw_input TEXT NOT NULL,
          processing_basis TEXT NOT NULL,
          resolution TEXT,
          is_resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at INTEGER,
          resolved_by TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sync_reports (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          report_type TEXT NOT NULL,
          content TEXT NOT NULL,
          generated_at INTEGER NOT NULL,
          generated_by TEXT NOT NULL
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export function getDb(): sqlite3.Database {
  return db;
}

export function run(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
