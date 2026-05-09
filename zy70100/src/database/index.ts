import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: Database;
let SQL: Awaited<ReturnType<typeof initSqlJs>>;

export async function initializeDb(): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!db) {
    const dbPath = process.env.DB_PATH;

    if (dbPath === ':memory:') {
      db = new SQL.Database();
    } else {
      const actualPath = dbPath || path.join(__dirname, '../../data/refund.db');
      const dir = path.dirname(actualPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(actualPath)) {
        const fileBuffer = fs.readFileSync(actualPath);
        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }

      setInterval(() => {
        if (db) {
          const data = db.export();
          const buffer = Buffer.from(data);
          fs.writeFileSync(actualPath, buffer);
        }
      }, 1000);
    }

    initializeSchema(db);
  }
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return db;
}

function initializeSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS charging_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      charge_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      total_requested_kwh REAL NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_segments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      segment_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      actual_kwh REAL NOT NULL,
      rate_id TEXT NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      is_refundable INTEGER NOT NULL DEFAULT 1,
      refund_percentage REAL NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS refund_requests (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      request_id TEXT NOT NULL UNIQUE,
      interruption_reason TEXT NOT NULL,
      interruption_time TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refund_records (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_stage TEXT,
      energy_refund_amount REAL NOT NULL DEFAULT 0,
      service_refund_amount REAL NOT NULL DEFAULT 0,
      total_refund_amount REAL NOT NULL DEFAULT 0,
      callback_count INTEGER NOT NULL DEFAULT 0,
      last_callback_at TEXT,
      last_callback_response TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refund_history (
      id TEXT PRIMARY KEY,
      refund_record_id TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT,
      message TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_refund_records_request_id ON refund_records(request_id);
    CREATE INDEX IF NOT EXISTS idx_refund_records_session_id ON refund_records(session_id);
    CREATE INDEX IF NOT EXISTS idx_refund_history_record_id ON refund_history(refund_record_id);
    CREATE INDEX IF NOT EXISTS idx_billing_segments_session_id ON billing_segments(session_id);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}

export { Database };
