import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../data/appointment.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS external_systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS department_slots (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      department_name TEXT NOT NULL,
      external_system_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      available_count INTEGER DEFAULT 0,
      locked_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (external_system_id) REFERENCES external_systems(id),
      UNIQUE(department_id, external_system_id, date, time_slot)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lock_records (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      lock_type TEXT DEFAULT 'temporary',
      status TEXT DEFAULT 'locked',
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (slot_id) REFERENCES department_slots(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS release_events (
      id TEXT PRIMARY KEY,
      lock_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      release_type TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lock_id) REFERENCES lock_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS conflict_records (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      resolved_at DATETIME,
      resolver_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS appointment_vouchers (
      id TEXT PRIMARY KEY,
      lock_id TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      voucher_code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'valid',
      check_in_time DATETIME,
      cancel_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lock_id) REFERENCES lock_records(id),
      FOREIGN KEY (slot_id) REFERENCES department_slots(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      before_state TEXT,
      after_state TEXT,
      result TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allQuery(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export default db;
