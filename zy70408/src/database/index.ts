import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'tenant_init.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS tenant_init_records (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tenant_name TEXT NOT NULL,
        package_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        current_step TEXT,
        error_message TEXT,
        material_summary TEXT,
        total_items INTEGER DEFAULT 0,
        success_items INTEGER DEFAULT 0,
        failed_items INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS init_detail_items (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        step TEXT NOT NULL,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES tenant_init_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS approval_nodes (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        node_name TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        approver TEXT NOT NULL,
        approved_at DATETIME,
        status TEXT NOT NULL DEFAULT 'PENDING',
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES tenant_init_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS attachment_revisions (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        detail_item_id TEXT NOT NULL,
        attachment_name TEXT NOT NULL,
        before_value TEXT NOT NULL,
        after_value TEXT NOT NULL,
        modified_by TEXT NOT NULL,
        modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approval_node_id TEXT,
        FOREIGN KEY (record_id) REFERENCES tenant_init_records(id),
        FOREIGN KEY (detail_item_id) REFERENCES init_detail_items(id),
        FOREIGN KEY (approval_node_id) REFERENCES approval_nodes(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS rollback_candidates (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES tenant_init_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS device_ledgers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        device_code TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_type TEXT NOT NULL,
        store_name TEXT NOT NULL,
        install_location TEXT,
        status TEXT NOT NULL,
        purchase_date DATETIME,
        warranty_period INTEGER,
        manufacturer TEXT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据库表初始化完成');
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

export function getQuery<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function allQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}
