import { Database } from 'sqlite3';
import { 
  Member, 
  Transaction, 
  PointRuleVersion, 
  PointLog, 
  Redemption, 
  RecalculationTask, 
  MemberRecalculationResult, 
  CompensationAdjustment 
} from '../types';

const DB_PATH = './points_system.db';

let db: Database;

export async function initDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function runDb(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function getDbOne<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export async function getDbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function createTables(): Promise<void> {
  await runDb(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS point_rule_versions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      rules TEXT NOT NULL,
      effective_at TEXT NOT NULL,
      is_frozen INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS point_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      transaction_id TEXT,
      redemption_id TEXT,
      recalculation_task_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (redemption_id) REFERENCES redemptions(id),
      FOREIGN KEY (recalculation_task_id) REFERENCES recalculation_tasks(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS redemptions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      gift_name TEXT NOT NULL,
      gift_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS recalculation_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rule_version_id TEXT NOT NULL,
      member_ids TEXT,
      start_time TEXT,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      total_members INTEGER NOT NULL DEFAULT 0,
      processed_members INTEGER NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0,
      summary TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (rule_version_id) REFERENCES point_rule_versions(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS member_recalculation_results (
      task_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      original_points INTEGER NOT NULL,
      new_points INTEGER NOT NULL,
      difference INTEGER NOT NULL,
      locked_points INTEGER NOT NULL,
      net_difference INTEGER NOT NULL,
      status TEXT NOT NULL,
      detail_sources TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (task_id, member_id),
      FOREIGN KEY (task_id) REFERENCES recalculation_tasks(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  await runDb(`
    CREATE TABLE IF NOT EXISTS compensation_adjustments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      point_log_id TEXT,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      approved_at TEXT,
      rejected_at TEXT,
      FOREIGN KEY (task_id) REFERENCES recalculation_tasks(id),
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (point_log_id) REFERENCES point_logs(id)
    )
  `);

  await runDb(`CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_point_logs_member_id ON point_logs(member_id)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_point_logs_transaction_id ON point_logs(transaction_id)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_redemptions_member_id ON redemptions(member_id)`);
  await runDb(`CREATE INDEX IF NOT EXISTS idx_recalculation_tasks_status ON recalculation_tasks(status)`);
}
