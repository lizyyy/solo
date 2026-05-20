const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cable_car.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no VARCHAR(50) UNIQUE NOT NULL,
      material_hash VARCHAR(64) UNIQUE NOT NULL,
      submitter VARCHAR(100) NOT NULL,
      submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'pending',
      cable_car_id VARCHAR(50) NOT NULL,
      cable_car_name VARCHAR(100) NOT NULL,
      inspection_date DATE NOT NULL,
      final_handler VARCHAR(100),
      final_approval_time DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      item_name VARCHAR(200) NOT NULL,
      item_result VARCHAR(20) NOT NULL,
      remark TEXT,
      inspector VARCHAR(100) NOT NULL,
      inspection_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trial_run_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      run_duration INTEGER NOT NULL,
      passenger_count INTEGER NOT NULL,
      abnormal_conditions TEXT,
      result VARCHAR(20) NOT NULL,
      operator VARCHAR(100) NOT NULL,
      run_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS approval_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      stage VARCHAR(50) NOT NULL,
      approver VARCHAR(100) NOT NULL,
      approval_result VARCHAR(20) NOT NULL,
      comment TEXT,
      approval_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
