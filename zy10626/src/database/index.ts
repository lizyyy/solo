import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/hospital.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        id_card TEXT UNIQUE NOT NULL,
        phone TEXT,
        created_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exam_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        department TEXT NOT NULL,
        price REAL NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS time_slots (
        id TEXT PRIMARY KEY,
        exam_item_id TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        total INTEGER NOT NULL DEFAULT 0,
        available INTEGER NOT NULL DEFAULT 0,
        occupied INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (exam_item_id) REFERENCES exam_items(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS checklists (
        id TEXT PRIMARY KEY,
        checklist_no TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_id_card TEXT NOT NULL,
        patient_phone TEXT,
        exam_item_id TEXT NOT NULL,
        exam_item_name TEXT NOT NULL,
        exam_item_code TEXT NOT NULL,
        department TEXT NOT NULL,
        time_slot_id TEXT NOT NULL,
        time_slot_date TEXT NOT NULL,
        time_slot_time TEXT NOT NULL,
        status TEXT NOT NULL,
        release_reason TEXT,
        release_remark TEXT,
        operator TEXT,
        business_object TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        released_at TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (exam_item_id) REFERENCES exam_items(id),
        FOREIGN KEY (time_slot_id) REFERENCES time_slots(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS checklist_history (
        id TEXT PRIMARY KEY,
        checklist_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        operator TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (checklist_id) REFERENCES checklists(id)
      )
    `);

    console.log('数据表初始化完成');
  });
}

export function runAsync(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getAsync<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row: T) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
