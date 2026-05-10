const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'exam.db');
const db = new sqlite3.Database(dbPath);

const examTypes = [
  {
    id: 'architect',
    name: '一级建造师',
    minEducation: '本科',
    minWorkYears: 4,
    description: '要求本科及以上学历，工作年限4年及以上'
  },
  {
    id: 'engineer',
    name: '中级工程师',
    minEducation: '专科',
    minWorkYears: 5,
    description: '要求专科及以上学历，工作年限5年及以上'
  },
  {
    id: 'accountant',
    name: '注册会计师',
    minEducation: '专科',
    minWorkYears: 2,
    description: '要求专科及以上学历，工作年限2年及以上'
  }
];

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS exam_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      min_education TEXT NOT NULL,
      min_work_years INTEGER NOT NULL,
      description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT NOT NULL UNIQUE,
      phone TEXT,
      education TEXT NOT NULL,
      work_years INTEGER NOT NULL,
      exam_type_id TEXT NOT NULL,
      photo_uploaded INTEGER DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      current_step TEXT DEFAULT 'initial',
      status TEXT DEFAULT 'pending',
      qualification_result TEXT,
      qualification_review_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_type_id) REFERENCES exam_types(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      step TEXT NOT NULL,
      result TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS import_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS import_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_record_id INTEGER NOT NULL,
      row_number INTEGER NOT NULL,
      row_data TEXT NOT NULL,
      error_message TEXT NOT NULL,
      FOREIGN KEY (import_record_id) REFERENCES import_records(id)
    )`);

    const insertStmt = db.prepare('INSERT OR IGNORE INTO exam_types (id, name, min_education, min_work_years, description) VALUES (?, ?, ?, ?, ?)');
    examTypes.forEach(type => {
      insertStmt.run(type.id, type.name, type.minEducation, type.minWorkYears, type.description);
    });
    insertStmt.finalize();
  });

  console.log('数据库初始化完成');
}

module.exports = { db, examTypes, initDatabase };
