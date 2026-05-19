const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'agent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT UNIQUE NOT NULL,
    agent_id INTEGER,
    transcript TEXT NOT NULL,
    call_time DATETIME NOT NULL,
    duration INTEGER,
    customer_phone TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inspection_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id INTEGER NOT NULL,
    has_apology INTEGER DEFAULT 0,
    has_refund_promise INTEGER DEFAULT 0,
    has_sensitive_word INTEGER DEFAULT 0,
    sensitive_words TEXT,
    summary TEXT,
    anomaly_types TEXT,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    review_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS batch_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    success_ids TEXT,
    failed_ids TEXT,
    error_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calls_call_time ON calls(call_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_call_id ON inspection_results(call_id)`);

  console.log('数据库表初始化完成');
});

db.close();
