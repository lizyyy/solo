const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/repair.db');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err);
        reject(err);
        return;
      }
      console.log('数据库连接成功');
    });

    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS repair_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        resident_id TEXT NOT NULL,
        resident_name TEXT,
        room_no TEXT,
        repair_type TEXT,
        description TEXT,
        screenshot_url TEXT,
        status TEXT DEFAULT 'pending',
        report_time TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS repair_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_no TEXT UNIQUE NOT NULL,
        order_no TEXT NOT NULL,
        repairman_id TEXT,
        repairman_name TEXT,
        arrival_time TEXT,
        complete_time TEXT,
        repair_content TEXT,
        is_rework INTEGER DEFAULT 0,
        is_part_replacement INTEGER DEFAULT 0,
        receipt_image_url TEXT,
        labor_fee REAL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_no) REFERENCES repair_orders(order_no)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS material_usages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usage_no TEXT UNIQUE NOT NULL,
        order_no TEXT NOT NULL,
        receipt_no TEXT,
        material_code TEXT,
        material_name TEXT,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        receiver TEXT,
        receive_time TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_no) REFERENCES repair_orders(order_no)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS refund_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trans_no TEXT UNIQUE NOT NULL,
        order_no TEXT NOT NULL,
        refund_amount REAL DEFAULT 0,
        refund_reason TEXT,
        trans_time TEXT,
        operator TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_no) REFERENCES repair_orders(order_no)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS dirty_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id TEXT,
        raw_content TEXT,
        dirty_type TEXT NOT NULL,
        field_name TEXT,
        error_message TEXT,
        suggestion TEXT,
        is_resolved INTEGER DEFAULT 0,
        resolved_by TEXT,
        resolved_at TEXT,
        resolved_note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS discrepancy_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discrepancy_no TEXT UNIQUE NOT NULL,
        order_no TEXT NOT NULL,
        discrepancy_type TEXT,
        description TEXT,
        before_snapshot TEXT,
        after_snapshot TEXT,
        reporter TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        before_data TEXT,
        after_data TEXT,
        operator TEXT,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reconcile_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_no TEXT UNIQUE NOT NULL,
        order_no TEXT NOT NULL,
        order_data TEXT,
        receipts_data TEXT,
        materials_data TEXT,
        refunds_data TEXT,
        total_labor_fee REAL DEFAULT 0,
        total_material_fee REAL DEFAULT 0,
        total_refund REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
        is_consistent INTEGER DEFAULT 1,
        issues TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_repair_orders_order_no ON repair_orders(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_repair_receipts_order_no ON repair_receipts(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_material_usages_order_no ON material_usages(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_refund_transactions_order_no ON refund_transactions(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_dirty_records_type ON dirty_records(dirty_type)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_discrepancy_order_no ON discrepancy_records(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_reconcile_order_no ON reconcile_snapshots(order_no)`);

      console.log('数据库表初始化完成');
      resolve(db);
    });
  });
};

module.exports = { initDatabase, DB_PATH };
