const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  } else {
    console.log('数据库连接成功');
  }
});

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        region TEXT NOT NULL,
        address TEXT,
        manager_name TEXT,
        manager_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        phone TEXT,
        id_card TEXT,
        position TEXT NOT NULL,
        store_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (store_id) REFERENCES stores(id)
      );

      CREATE TABLE IF NOT EXISTS shift_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        break_minutes INTEGER DEFAULT 60,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transfer_shifts (
        id TEXT PRIMARY KEY,
        transfer_no TEXT NOT NULL UNIQUE,
        employee_id TEXT NOT NULL,
        employee_code TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        original_store_id TEXT NOT NULL,
        original_store_code TEXT NOT NULL,
        original_store_name TEXT NOT NULL,
        target_store_id TEXT NOT NULL,
        target_store_code TEXT NOT NULL,
        target_store_name TEXT NOT NULL,
        shift_date DATE NOT NULL,
        shift_template_id TEXT NOT NULL,
        shift_template_name TEXT NOT NULL,
        shift_start_time TEXT NOT NULL,
        shift_end_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_confirmation',
        conflict_note TEXT,
        conflict_resolved_at DATETIME,
        conflict_resolved_by TEXT,
        conflict_resolved_note TEXT,
        remark TEXT,
        created_by TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_from TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (original_store_id) REFERENCES stores(id),
        FOREIGN KEY (target_store_id) REFERENCES stores(id)
      );

      CREATE TABLE IF NOT EXISTS transfer_history (
        id TEXT PRIMARY KEY,
        transfer_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        operation_from TEXT NOT NULL,
        note TEXT,
        changed_fields TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transfer_id) REFERENCES transfer_shifts(id)
      );

      CREATE TABLE IF NOT EXISTS import_bad_records (
        id TEXT PRIMARY KEY,
        batch_no TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        raw_data TEXT NOT NULL,
        error_message TEXT NOT NULL,
        imported_by TEXT NOT NULL,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_shifts(status);
      CREATE INDEX IF NOT EXISTS idx_transfer_employee ON transfer_shifts(employee_id);
      CREATE INDEX IF NOT EXISTS idx_transfer_date ON transfer_shifts(shift_date);
      CREATE INDEX IF NOT EXISTS idx_history_transfer ON transfer_history(transfer_id);
    `, (err) => {
      if (err) reject(err);
      else {
        console.log('数据库表创建成功');
        resolve();
      }
    });
  });
};

createTables().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('数据库初始化失败:', err);
  db.close();
  process.exit(1);
});
