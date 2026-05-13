const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS ayi_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ayi_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    id_card VARCHAR(50),
    skills TEXT,
    experience_years INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    req_id VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    address TEXT,
    service_type VARCHAR(50),
    requirements TEXT,
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS trial_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkin_id VARCHAR(50) UNIQUE NOT NULL,
    ayi_id VARCHAR(50) NOT NULL,
    req_id VARCHAR(50) NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(20),
    actual_checkin DATETIME,
    actual_checkout DATETIME,
    status VARCHAR(20) DEFAULT 'scheduled',
    change_reason TEXT,
    changed_by VARCHAR(50),
    changed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ayi_id) REFERENCES ayi_profiles(ayi_id),
    FOREIGN KEY (req_id) REFERENCES customer_requirements(req_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eval_id VARCHAR(50) UNIQUE NOT NULL,
    checkin_id VARCHAR(50) NOT NULL,
    ayi_id VARCHAR(50) NOT NULL,
    req_id VARCHAR(50) NOT NULL,
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    attitude_rating INTEGER CHECK (attitude_rating BETWEEN 1 AND 5),
    skill_rating INTEGER CHECK (skill_rating BETWEEN 1 AND 5),
    punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    comments TEXT,
    is_abnormal BOOLEAN DEFAULT 0,
    abnormal_reason TEXT,
    reviewed_by VARCHAR(50),
    reviewed_at DATETIME,
    status VARCHAR(20) DEFAULT 'submitted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (checkin_id) REFERENCES trial_checkins(checkin_id),
    FOREIGN KEY (ayi_id) REFERENCES ayi_profiles(ayi_id),
    FOREIGN KEY (req_id) REFERENCES customer_requirements(req_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deposit_id VARCHAR(50) UNIQUE NOT NULL,
    ayi_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_date DATE,
    receipt_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    review_status VARCHAR(20) DEFAULT 'pending',
    reviewed_by VARCHAR(50),
    reviewed_at DATETIME,
    review_comments TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ayi_id) REFERENCES ayi_profiles(ayi_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contract_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deduction_id VARCHAR(50) UNIQUE NOT NULL,
    deposit_id VARCHAR(50) NOT NULL,
    ayi_id VARCHAR(50) NOT NULL,
    req_id VARCHAR(50) NOT NULL,
    contract_id VARCHAR(50),
    deduction_amount DECIMAL(10,2) NOT NULL,
    remaining_amount DECIMAL(10,2),
    deduction_date DATE,
    status VARCHAR(20) DEFAULT 'completed',
    idempotency_key VARCHAR(100) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deposit_id) REFERENCES deposits(deposit_id),
    FOREIGN KEY (ayi_id) REFERENCES ayi_profiles(ayi_id),
    FOREIGN KEY (req_id) REFERENCES customer_requirements(req_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timeline_id VARCHAR(50) UNIQUE NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    status VARCHAR(20) NOT NULL,
    result_type VARCHAR(20) NOT NULL,
    description TEXT,
    operator VARCHAR(50),
    operation_data TEXT,
    failure_reason TEXT,
    idempotency_key VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotency_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    result_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库表创建完成');
});

db.close();