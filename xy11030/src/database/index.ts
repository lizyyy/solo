import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/reissue.db');

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
        CREATE TABLE IF NOT EXISTS reissue_orders (
          id TEXT PRIMARY KEY,
          order_no TEXT UNIQUE NOT NULL,
          group_buy_code TEXT NOT NULL,
          group_buy_name TEXT NOT NULL,
          leader_id TEXT NOT NULL,
          leader_name TEXT NOT NULL,
          leader_phone TEXT NOT NULL,
          warehouse_code TEXT NOT NULL,
          warehouse_name TEXT NOT NULL,
          original_order_no TEXT NOT NULL,
          original_order_date TEXT NOT NULL,
          status TEXT NOT NULL,
          total_amount REAL NOT NULL DEFAULT 0,
          total_items INTEGER NOT NULL DEFAULT 0,
          remark TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS reissue_items (
          id TEXT PRIMARY KEY,
          reissue_order_id TEXT NOT NULL,
          product_code TEXT NOT NULL,
          product_name TEXT NOT NULL,
          sku_code TEXT NOT NULL,
          sku_name TEXT NOT NULL,
          issue_type TEXT NOT NULL,
          original_quantity INTEGER NOT NULL,
          issue_quantity INTEGER NOT NULL,
          reissue_quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          remark TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (reissue_order_id) REFERENCES reissue_orders(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS reissue_history (
          id TEXT PRIMARY KEY,
          reissue_order_id TEXT NOT NULL,
          action TEXT NOT NULL,
          previous_status TEXT,
          new_status TEXT,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          remark TEXT,
          change_details TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (reissue_order_id) REFERENCES reissue_orders(id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_reissue_orders_status ON reissue_orders(status)`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_reissue_orders_leader ON reissue_orders(leader_id)`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_reissue_items_order ON reissue_items(reissue_order_id)`, (err) => {
        if (err) reject(err);
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_reissue_history_order ON reissue_history(reissue_order_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const runQuery = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

export const runSingleQuery = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
};

export const runExecute = (sql: string, params: any[] = []): Promise<{ lastID: any; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};
