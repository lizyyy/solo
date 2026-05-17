import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pricelist.db');
const db = new sqlite3.Database(dbPath);

export const initDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    const tables = [
      `CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        region TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS price_lists (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        effective_time DATETIME,
        approver_id TEXT,
        approver_name TEXT,
        approved_at DATETIME,
        created_by TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS price_list_stores (
        id TEXT PRIMARY KEY,
        price_list_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        store_code TEXT NOT NULL,
        store_name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        conflict_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (price_list_id) REFERENCES price_lists(id)
      )`,
      `CREATE TABLE IF NOT EXISTS price_list_items (
        id TEXT PRIMARY KEY,
        price_list_id TEXT NOT NULL,
        sku_code TEXT NOT NULL,
        sku_name TEXT NOT NULL,
        original_price DECIMAL(10,2) NOT NULL,
        sale_price DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (price_list_id) REFERENCES price_lists(id)
      )`,
      `CREATE TABLE IF NOT EXISTS price_list_history (
        id TEXT PRIMARY KEY,
        price_list_id TEXT NOT NULL,
        action TEXT NOT NULL,
        action_by TEXT NOT NULL,
        action_by_name TEXT NOT NULL,
        remark TEXT,
        old_status TEXT,
        new_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS import_bad_rows (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        raw_data TEXT NOT NULL,
        error_message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    let completed = 0;
    tables.forEach(sql => {
      db.run(sql, (err) => {
        if (err) return reject(err);
        completed++;
        if (completed === tables.length) {
          resolve();
        }
      });
    });
  });
};

export default db;
