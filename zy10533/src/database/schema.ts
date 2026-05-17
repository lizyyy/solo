import sqlite3 from 'sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'queue_adjustments.db');

let db: sqlite3.Database | null = null;

export const getDatabase = (): sqlite3.Database => {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to open database:', err.message);
        throw err;
      }
      console.log('Connected to SQLite database');
    });
  }
  return db;
};

export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    database.serialize(() => {
      database.run(`
        CREATE TABLE IF NOT EXISTS queue_adjustments (
          id TEXT PRIMARY KEY,
          idempotency_key TEXT UNIQUE NOT NULL,
          queue_name TEXT NOT NULL,
          original_priority INTEGER NOT NULL,
          target_priority INTEGER NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL,
          recovery_condition TEXT NOT NULL,
          scheduled_at TEXT NOT NULL,
          activated_at TEXT,
          restored_at TEXT,
          completed_at TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          report TEXT
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS affected_tasks (
          id TEXT PRIMARY KEY,
          adjustment_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          task_type TEXT NOT NULL,
          original_priority INTEGER NOT NULL,
          adjusted_priority INTEGER NOT NULL,
          affected_at TEXT NOT NULL,
          recovered_at TEXT,
          metadata TEXT,
          FOREIGN KEY (adjustment_id) REFERENCES queue_adjustments(id)
        )
      `);

      database.run(`
        CREATE TABLE IF NOT EXISTS failure_records (
          id TEXT PRIMARY KEY,
          adjustment_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          original_input TEXT NOT NULL,
          processing_basis TEXT NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          final_conclusion TEXT,
          resolved_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (adjustment_id) REFERENCES queue_adjustments(id)
        )
      `);

      database.run(`
        CREATE INDEX IF NOT EXISTS idx_adjustments_status ON queue_adjustments(status)
      `);
      
      database.run(`
        CREATE INDEX IF NOT EXISTS idx_adjustments_queue ON queue_adjustments(queue_name)
      `);
      
      database.run(`
        CREATE INDEX IF NOT EXISTS idx_affected_tasks_adjustment ON affected_tasks(adjustment_id)
      `);
      
      database.run(`
        CREATE INDEX IF NOT EXISTS idx_failures_adjustment ON failure_records(adjustment_id)
      `);

      resolve();
    });
  });
};

export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else {
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};
