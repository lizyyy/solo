const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(__dirname, '..', 'data', 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    requirements TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    id_card TEXT,
    age INTEGER,
    skills TEXT,
    experience_years INTEGER,
    status TEXT DEFAULT 'available',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trial_schedules (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (worker_id) REFERENCES workers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposit_transactions (
    id TEXT PRIMARY KEY,
    trial_schedule_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    transaction_no TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trial_schedule_id) REFERENCES trial_schedules(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    trial_schedule_id TEXT NOT NULL,
    overall_rating INTEGER NOT NULL,
    punctuality_rating INTEGER,
    attitude_rating INTEGER,
    skill_rating INTEGER,
    comments TEXT,
    reviewer_name TEXT,
    status TEXT DEFAULT 'pending',
    review_notes TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trial_schedule_id) REFERENCES trial_schedules(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS conversion_conclusions (
    id TEXT PRIMARY KEY,
    trial_schedule_id TEXT NOT NULL,
    evaluation_id TEXT,
    result TEXT NOT NULL,
    salary_proposal REAL,
    start_date TEXT,
    contract_terms TEXT,
    notes TEXT,
    status TEXT DEFAULT 'draft',
    exported_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trial_schedule_id) REFERENCES trial_schedules(id),
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS processing_records (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    reference_id TEXT,
    reference_type TEXT,
    input_data TEXT,
    processing_result TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    operator TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_schedule_customer ON trial_schedules(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_schedule_worker ON trial_schedules(worker_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deposit_schedule ON deposit_transactions(trial_schedule_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_evaluation_schedule ON evaluations(trial_schedule_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conclusion_schedule ON conversion_conclusions(trial_schedule_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_processing_ref ON processing_records(reference_id, reference_type)`);

  console.log('所有表创建成功');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库连接已关闭');
});
