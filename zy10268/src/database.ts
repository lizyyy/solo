import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await open({
      filename: './dedicated-line.db',
      driver: sqlite3.Database
    });
    await initializeTables(db);
  }
  return db;
}

async function initializeTables(db: Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dedicated_line_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      bandwidth INTEGER NOT NULL,
      status TEXT NOT NULL,
      device_id TEXT,
      is_billing INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      device_no TEXT UNIQUE NOT NULL,
      device_type TEXT NOT NULL,
      is_bound INTEGER NOT NULL DEFAULT 0,
      bound_order_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS construction_progress (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      node TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      remark TEXT,
      UNIQUE(order_id, node)
    );

    CREATE TABLE IF NOT EXISTS operation_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      operator TEXT NOT NULL,
      department TEXT NOT NULL,
      before_state TEXT NOT NULL,
      after_state TEXT NOT NULL,
      reason TEXT,
      request_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_request_id ON operation_history(request_id);
    CREATE INDEX IF NOT EXISTS idx_history_order_id ON operation_history(order_id);
    CREATE INDEX IF NOT EXISTS idx_construction_order_id ON construction_progress(order_id);
  `);

  await seedDevices(db);
}

async function seedDevices(db: Database) {
  const count = await db.get('SELECT COUNT(*) as count FROM devices');
  if (count.count === 0) {
    const devices = [
      { id: 'dev-001', deviceNo: 'CPE-2024-001', deviceType: 'CPE' },
      { id: 'dev-002', deviceNo: 'CPE-2024-002', deviceType: 'CPE' },
      { id: 'dev-003', deviceNo: 'CPE-2024-003', deviceType: 'CPE' },
      { id: 'dev-004', deviceNo: 'OLT-2024-001', deviceType: 'OLT' },
      { id: 'dev-005', deviceNo: 'OLT-2024-002', deviceType: 'OLT' }
    ];

    for (const device of devices) {
      await db.run(
        'INSERT INTO devices (id, device_no, device_type, is_bound, bound_order_id, created_at) VALUES (?, ?, ?, 0, NULL, ?)',
        [device.id, device.deviceNo, device.deviceType, new Date().toISOString()]
      );
    }
  }
}
