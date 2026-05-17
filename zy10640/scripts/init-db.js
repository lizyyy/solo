const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'trial-extension.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('已创建数据目录:', DATA_DIR);
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = OFF');

  console.log('开始创建数据库表...');

  db.run(`DROP TABLE IF EXISTS extension_history`);
  db.run(`DROP TABLE IF EXISTS trial_extensions`);
  db.run(`DROP TABLE IF EXISTS tenants`);
  db.run(`DROP TABLE IF EXISTS import_records`);

  db.run(`CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id VARCHAR(64) UNIQUE NOT NULL,
    tenant_name VARCHAR(128) NOT NULL,
    industry VARCHAR(64),
    contact_person VARCHAR(64),
    contact_phone VARCHAR(32),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('✓ 已创建租户表');

  db.run(`CREATE TABLE trial_extensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension_no VARCHAR(64) UNIQUE NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    original_trial_end_date DATE NOT NULL,
    requested_extension_days INTEGER NOT NULL,
    new_trial_end_date DATE NOT NULL,
    extension_reason TEXT NOT NULL,
    sales_notes TEXT,
    salesperson_id VARCHAR(64) NOT NULL,
    salesperson_name VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    approver_id VARCHAR(64),
    approver_name VARCHAR(64),
    approval_comment TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    CHECK (status IN ('trial_active', 'extension_pending', 'extension_approved', 'converted'))
  )`);
  console.log('✓ 已创建试用延期审批表');

  db.run(`CREATE TABLE extension_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension_id INTEGER NOT NULL,
    action VARCHAR(64) NOT NULL,
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    operator_id VARCHAR(64),
    operator_name VARCHAR(64),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (extension_id) REFERENCES trial_extensions(id) ON DELETE CASCADE
  )`);
  console.log('✓ 已创建历史记录表');

  db.run(`CREATE TABLE import_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no VARCHAR(64) NOT NULL,
    row_number INTEGER NOT NULL,
    raw_data TEXT,
    error_message TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('pending', 'success', 'failed'))
  )`);
  console.log('✓ 已创建导入记录表');

  db.run(`CREATE INDEX idx_extension_tenant ON trial_extensions(tenant_id)`);
  db.run(`CREATE INDEX idx_extension_status ON trial_extensions(status)`);
  db.run(`CREATE INDEX idx_extension_salesperson ON trial_extensions(salesperson_id)`);
  db.run(`CREATE INDEX idx_history_extension ON extension_history(extension_id)`);
  console.log('✓ 已创建索引');

  db.run('PRAGMA foreign_keys = ON');
  console.log('');
  console.log('数据库初始化完成！');
  console.log('数据库路径:', DB_PATH);
});

db.close();
