const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/water-bucket.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      area_type TEXT CHECK(area_type IN ('residential', 'commercial', 'office')),
      bucket_capacity INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS buckets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bucket_code TEXT UNIQUE NOT NULL,
      status TEXT CHECK(status IN ('available', 'in_use', 'damaged', 'lost', 'seized')) DEFAULT 'available',
      bucket_type TEXT DEFAULT 'standard',
      manufacture_date DATE,
      last_inspection_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS delivery_signoffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_no TEXT UNIQUE NOT NULL,
      customer_address_id INTEGER NOT NULL,
      bucket_codes TEXT NOT NULL,
      bucket_count INTEGER NOT NULL,
      delivery_date DATE NOT NULL,
      delivery_person TEXT NOT NULL,
      receiver_name TEXT,
      receiver_phone TEXT,
      signoff_photo TEXT,
      remarks TEXT,
      status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_address_id) REFERENCES customer_addresses(id)
    );

    CREATE TABLE IF NOT EXISTS bucket_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      delivery_no TEXT NOT NULL,
      customer_address_id INTEGER NOT NULL,
      bucket_codes TEXT NOT NULL,
      bucket_count INTEGER NOT NULL,
      return_date DATE NOT NULL,
      collector_name TEXT NOT NULL,
      inspector_name TEXT,
      inspection_result TEXT CHECK(inspection_result IN ('pending', 'passed', 'failed', 'needs_review')),
      inspection_remarks TEXT,
      status TEXT CHECK(status IN ('pending', 'inspecting', 'accepted', 'rejected', 'reviewing', 'completed')) DEFAULT 'pending',
      is_blocked INTEGER DEFAULT 0,
      block_reason TEXT,
      reviewed_by TEXT,
      reviewed_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_address_id) REFERENCES customer_addresses(id)
    );

    CREATE TABLE IF NOT EXISTS damage_seizures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seizure_no TEXT UNIQUE NOT NULL,
      return_no TEXT NOT NULL,
      bucket_code TEXT NOT NULL,
      damage_type TEXT CHECK(damage_type IN ('crack', 'leak', 'deformation', 'missing_parts', 'contamination', 'other')) NOT NULL,
      damage_level TEXT CHECK(damage_level IN ('minor', 'moderate', 'severe')) NOT NULL,
      seizure_reason TEXT,
      is_compensable INTEGER DEFAULT 1,
      compensation_amount DECIMAL(10, 2),
      status TEXT CHECK(status IN ('pending', 'confirmed', 'appealed', 'resolved')) DEFAULT 'pending',
      handled_by TEXT NOT NULL,
      previous_handler TEXT,
      change_reason TEXT,
      affected_records TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bucket_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_address_id INTEGER UNIQUE NOT NULL,
      total_borrowed INTEGER DEFAULT 0,
      total_returned INTEGER DEFAULT 0,
      total_damaged INTEGER DEFAULT 0,
      total_seized INTEGER DEFAULT 0,
      outstanding_balance INTEGER DEFAULT 0,
      balance_amount DECIMAL(10, 2) DEFAULT 0,
      last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_address_id) REFERENCES customer_addresses(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      record_no TEXT,
      before_values TEXT,
      after_values TEXT,
      operator TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operation_remark TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
    CREATE INDEX IF NOT EXISTS idx_buckets_bucket_code ON buckets(bucket_code);
    CREATE INDEX IF NOT EXISTS idx_delivery_signoffs_delivery_no ON delivery_signoffs(delivery_no);
    CREATE INDEX IF NOT EXISTS idx_bucket_returns_return_no ON bucket_returns(return_no);
    CREATE INDEX IF NOT EXISTS idx_damage_seizures_seizure_no ON damage_seizures(seizure_no);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_module ON operation_logs(module);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_operator ON operation_logs(operator);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
  `);

  console.log('数据库表初始化完成');
};

const initSampleData = () => {
  const bucketCount = db.prepare('SELECT COUNT(*) as count FROM buckets').get();
  if (bucketCount.count === 0) {
    const insertBucket = db.prepare('INSERT INTO buckets (bucket_code, status, bucket_type) VALUES (?, ?, ?)');
    for (let i = 1; i <= 100; i++) {
      const code = `BT${String(i).padStart(6, '0')}`;
      insertBucket.run(code, 'available', 'standard');
    }

    const insertAddress = db.prepare(`
      INSERT INTO customer_addresses 
      (customer_id, customer_name, phone, address, area_type, bucket_capacity, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAddress.run('C001', '张三', '13800138001', '北京市朝阳区建国路88号', 'residential', 10, 'system');
    insertAddress.run('C002', '李四科技有限公司', '13800138002', '上海市浦东新区张江高科技园区', 'office', 50, 'system');

    console.log('示例数据初始化完成');
  }
};

initTables();
initSampleData();

module.exports = db;
