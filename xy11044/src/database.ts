import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'seafood-inspection.db');

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
      CREATE TABLE IF NOT EXISTS inspection_orders (
        id TEXT PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        supplier_id TEXT NOT NULL,
        supplier_name TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        vehicle_no TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        total_quantity REAL NOT NULL DEFAULT 0,
        total_weight REAL NOT NULL DEFAULT 0,
        total_loss_weight REAL NOT NULL DEFAULT 0,
        total_loss_rate REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        inspector_id TEXT,
        inspector_name TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT,
        manual_processed_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS inspection_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        seafood_type TEXT NOT NULL,
        seafood_name TEXT NOT NULL,
        seafood_spec TEXT,
        is_live INTEGER NOT NULL DEFAULT 0,
        expected_quantity REAL NOT NULL,
        expected_weight REAL NOT NULL,
        actual_quantity REAL NOT NULL,
        actual_weight REAL NOT NULL,
        loss_weight REAL NOT NULL DEFAULT 0,
        loss_rate REAL NOT NULL DEFAULT 0,
        temperature REAL,
        salinity REAL,
        ph_value REAL,
        quality_level TEXT,
        abnormal_description TEXT,
        image_urls TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES inspection_orders(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS inspection_history (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        operator_id TEXT,
        operator_name TEXT,
        before_status TEXT,
        after_status TEXT,
        change_content TEXT NOT NULL,
        remark TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES inspection_orders(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_inspection_orders_date ON inspection_orders(delivery_date)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_inspection_orders_status ON inspection_orders(status)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_inspection_items_order ON inspection_items(order_id)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_inspection_history_order ON inspection_history(order_id)
    `);
  });
}

export function runAsync(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getAsync<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function allAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}
