const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'dental.db');

const createTablesSQL = `
-- 处方表
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  doctor_name TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  clinic TEXT NOT NULL,
  tooth_position TEXT NOT NULL,
  denture_type TEXT NOT NULL,
  due_date TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  return_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- 模型批次表
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  model_number TEXT NOT NULL,
  technician TEXT NOT NULL,
  expected_finish_date TEXT,
  notes TEXT,
  status TEXT DEFAULT 'created',
  rework_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
);

-- 制作工序表
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  process_code TEXT NOT NULL,
  process_name TEXT NOT NULL,
  department TEXT,
  sequence INTEGER,
  status TEXT DEFAULT 'pending',
  operator TEXT,
  notes TEXT,
  completed_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- 返修申请表
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  reason_detail TEXT,
  returned_by TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'submitted',
  resolved_by TEXT,
  resolution_notes TEXT,
  resolved_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- 责任归因表
CREATE TABLE IF NOT EXISTS responsibilities (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  primary_department TEXT NOT NULL,
  secondary_departments TEXT,
  operator TEXT,
  process_code TEXT,
  process_name TEXT,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (return_id) REFERENCES returns(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_batches_prescription ON batches(prescription_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_batch ON work_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_returns_prescription ON returns(prescription_id);
CREATE INDEX IF NOT EXISTS idx_returns_batch ON returns(batch_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_responsibilities_return ON responsibilities(return_id);
CREATE INDEX IF NOT EXISTS idx_responsibilities_department ON responsibilities(primary_department);
`;

console.log('='.repeat(60));
console.log('初始化数据库...');
console.log('数据库路径:', DB_PATH);
console.log('='.repeat(60));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.exec(createTablesSQL, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
      process.exit(1);
    }
    console.log('✓ 数据库表创建成功');
    db.close((err) => {
      if (err) {
        console.error('关闭数据库失败:', err.message);
        process.exit(1);
      }
      console.log('✓ 数据库初始化完成');
      console.log('='.repeat(60));
      process.exit(0);
    });
  });
});
