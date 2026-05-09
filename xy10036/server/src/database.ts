import sqlite3 from 'sqlite3'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const DB_PATH = path.join(__dirname, '../../data/device-borrowing.db')

sqlite3.verbose()

export interface IDatabase {
  run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }>
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>
  all<T = any>(sql: string, params?: any[]): Promise<T[]>
  exec(sql: string): Promise<void>
  serialize(callback: () => void): void
  close(): Promise<void>
}

class DatabaseWrapper implements IDatabase {
  private db: sqlite3.Database

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath)
  }

  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err)
        else resolve({ lastID: this.lastID, changes: this.changes })
      })
    })
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row as T)
      })
    })
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows as T[])
      })
    })
  }

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  serialize(callback: () => void): void {
    this.db.serialize(callback)
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

export let db: IDatabase

export async function initDatabase(): Promise<void> {
  db = new DatabaseWrapper(DB_PATH)

  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      status TEXT NOT NULL CHECK(status IN ('available', 'borrowed', 'maintenance', 'retired')),
      current_borrower_id TEXT,
      current_borrower_name TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS borrow_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      borrow_time TEXT NOT NULL,
      expected_return_time TEXT NOT NULL,
      actual_return_time TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'borrowed', 'returned', 'overdue')),
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete', 'borrow', 'return', 'status_change')),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('device', 'borrow_record', 'user')),
      entity_id TEXT NOT NULL,
      entity_name TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      before TEXT,
      after TEXT,
      request_id TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotent_requests (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE NOT NULL,
      endpoint TEXT NOT NULL,
      response TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_borrow_records_device ON borrow_records(device_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_records_user ON borrow_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_records_status ON borrow_records(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs(request_id);
    CREATE INDEX IF NOT EXISTS idx_idempotent_requests_expiry ON idempotent_requests(expires_at);
  `)

  const now = new Date().toISOString()

  const existingAdmin = await db.get('SELECT id FROM users WHERE email = ?', ['admin@example.com'])
  if (!existingAdmin) {
    await db.run(
      'INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin-user-id', '管理员', 'admin@example.com', 'admin', now, now]
    )
  }

  const existingUser = await db.get('SELECT id FROM users WHERE email = ?', ['user@example.com'])
  if (!existingUser) {
    await db.run(
      'INSERT INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['demo-user-id', '测试用户', 'user@example.com', 'user', now, now]
    )
  }

  const deviceCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM devices')
  if (deviceCount && deviceCount.count === 0) {
    const devices = [
      { id: uuidv4(), name: '投影仪 A', code: 'PRJ-001', type: '投影仪', status: 'available' },
      { id: uuidv4(), name: '笔记本电脑 B', code: 'LAP-002', type: '笔记本电脑', status: 'available' },
      { id: uuidv4(), name: '数码相机 C', code: 'CAM-003', type: '相机', status: 'available' },
      { id: uuidv4(), name: '移动硬盘 D', code: 'HDD-004', type: '存储设备', status: 'available' },
    ]

    for (const device of devices) {
      await db.run(
        'INSERT INTO devices (id, name, code, type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [device.id, device.name, device.code, device.type, device.status, now, now]
      )
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close()
  }
}
