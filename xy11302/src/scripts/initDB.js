const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/homestay.db');

const initTables = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
    });

    const tables = [
      `CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT NOT NULL UNIQUE,
        room_type TEXT,
        floor INTEGER,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cleaning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        room_number TEXT NOT NULL,
        cleaner_name TEXT NOT NULL,
        check_date DATE NOT NULL,
        check_time TIME,
        status TEXT DEFAULT 'pending',
        photo_urls TEXT,
        quality_score INTEGER,
        has_issue INTEGER DEFAULT 0,
        issue_description TEXT,
        reviewer_name TEXT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        room_number TEXT,
        complaint_type TEXT NOT NULL,
        description TEXT NOT NULL,
        reporter_name TEXT,
        reporter_phone TEXT,
        handler_name TEXT,
        status TEXT DEFAULT 'pending',
        handling_result TEXT,
        deduction_amount DECIMAL(10,2) DEFAULT 0,
        occurred_at DATETIME,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS reworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cleaning_record_id INTEGER,
        room_number TEXT NOT NULL,
        original_cleaner TEXT,
        reworker_name TEXT,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        rework_date DATE,
        reviewer_name TEXT,
        reviewed_at DATETIME,
        deduction_amount DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        settlement_month TEXT NOT NULL,
        cleaner_name TEXT NOT NULL,
        total_cleanings INTEGER DEFAULT 0,
        total_reworks INTEGER DEFAULT 0,
        total_complaints INTEGER DEFAULT 0,
        total_deduction DECIMAL(10,2) DEFAULT 0,
        final_amount DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'draft',
        reviewed_by TEXT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id INTEGER,
        operator_name TEXT,
        old_value TEXT,
        new_value TEXT,
        description TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS import_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_number TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        total_records INTEGER DEFAULT 0,
        normal_records INTEGER DEFAULT 0,
        abnormal_records INTEGER DEFAULT 0,
        imported_by TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'completed'
      )`
    ];

    let completed = 0;
    tables.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          console.error('创建表失败:', err);
          reject(err);
          return;
        }
        completed++;
        if (completed === tables.length) {
          console.log('✅ 所有数据库表初始化完成');
          db.close();
          resolve();
        }
      });
    });
  });
};

initTables()
  .then(() => {
    console.log('🎉 数据库初始化成功!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 初始化失败:', err);
    process.exit(1);
  });