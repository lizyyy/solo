import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../promo-code-risk.db');

let db: sqlite3.Database;
let initPromise: Promise<void>;

function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('数据库连接成功');
      
      db.serialize(() => {
        const createTables = [
          `CREATE TABLE IF NOT EXISTS promo_codes (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
            discount_value REAL NOT NULL,
            max_usage INTEGER NOT NULL DEFAULT 1,
            current_usage INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired', 'cancelled')),
            valid_from DATETIME NOT NULL,
            valid_to DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS user_devices (
            id TEXT PRIMARY KEY,
            device_id TEXT UNIQUE NOT NULL,
            user_id TEXT,
            ip_address TEXT NOT NULL,
            user_agent TEXT NOT NULL,
            risk_score INTEGER NOT NULL DEFAULT 0,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            last_attempt_at DATETIME,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS risk_rules (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            config TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS block_events (
            id TEXT PRIMARY KEY,
            promo_code_id TEXT NOT NULL,
            promo_code TEXT NOT NULL,
            device_id TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            risk_level TEXT NOT NULL,
            triggered_rules TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'blocked' CHECK(status IN ('pending', 'allowed', 'blocked', 'manual_allowed', 'compensated')),
            reason TEXT NOT NULL,
            compensated_at DATETIME,
            compensated_by TEXT,
            compensated_note TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS allow_records (
            id TEXT PRIMARY KEY,
            promo_code_id TEXT NOT NULL,
            promo_code TEXT NOT NULL,
            device_id TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            is_manual INTEGER NOT NULL DEFAULT 0,
            approved_by TEXT,
            created_at DATETIME NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS attempt_logs (
            id TEXT PRIMARY KEY,
            promo_code_id TEXT NOT NULL,
            promo_code TEXT NOT NULL,
            device_id TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT NOT NULL,
            success INTEGER NOT NULL DEFAULT 0,
            error_code TEXT,
            error_message TEXT,
            created_at DATETIME NOT NULL
          )`
        ];

        let completed = 0;
        createTables.forEach((sql, index) => {
          db.run(sql, (err) => {
            if (err) {
              console.error('创建表失败:', err.message);
              reject(err);
              return;
            }
            completed++;
            if (completed === createTables.length) {
              console.log('数据表初始化完成');
              resolve();
            }
          });
        });
      });
    });
  });
}

initPromise = initializeDatabase();

export function getDatabase(): Promise<sqlite3.Database> {
  return initPromise.then(() => db);
}

export function runQuery(sql: string, params: any[] = []): Promise<any> {
  return initPromise.then(() => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  });
}

export function getOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return initPromise.then(() => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T || null);
      });
    });
  });
}

export function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return initPromise.then(() => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  });
}

export { initPromise };
