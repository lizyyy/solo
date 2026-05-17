import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/database.db');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS supplement_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          waybill_no TEXT NOT NULL,
          carrier TEXT NOT NULL,
          node_time TEXT NOT NULL,
          node_type TEXT,
          supplement_source TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          handler TEXT,
          business_object TEXT,
          conflict_info TEXT,
          remark TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(waybill_no, carrier, node_time)
        )
      `, (err) => {
        if (err) reject(err);
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS history_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          from_status TEXT,
          to_status TEXT,
          operator TEXT,
          remark TEXT,
          change_detail TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (record_id) REFERENCES supplement_records(id)
        )
      `, (err) => {
        if (err) reject(err);
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_supplement_waybill ON supplement_records(waybill_no)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_supplement_status ON supplement_records(status)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_supplement_date ON supplement_records(created_at)
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_history_record ON history_logs(record_id)
      `);

      resolve();
    });
  });
};

export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      resolve();
    });
  });
};
