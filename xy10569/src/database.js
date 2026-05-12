const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('./config');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(config.db.path);

function runSync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastInsertRowid: this.lastID });
    });
  });
}

function getSync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allSync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function execSync(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initDatabase() {
  await execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  await execSync(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      head_teacher_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      gender TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      teacher_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'teacher',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      isbn TEXT,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      location TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS borrow_records (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      student_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      borrower_type TEXT NOT NULL DEFAULT 'student',
      borrower_name TEXT NOT NULL,
      book_title TEXT NOT NULL,
      borrow_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      renew_times INTEGER NOT NULL DEFAULT 0,
      max_renew_times INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'borrowed',
      is_batch_borrow INTEGER NOT NULL DEFAULT 0,
      batch_id TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batch_borrows (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      book_count INTEGER NOT NULL DEFAULT 0,
      borrow_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS renew_records (
      id TEXT PRIMARY KEY,
      borrow_id TEXT NOT NULL,
      old_due_date TEXT NOT NULL,
      new_due_date TEXT NOT NULL,
      renew_count INTEGER NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batch_returns (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      return_date TEXT NOT NULL,
      total_books INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      result_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batch_return_items (
      id TEXT PRIMARY KEY,
      batch_return_id TEXT NOT NULL,
      borrow_id TEXT NOT NULL,
      student_name TEXT,
      book_title TEXT,
      book_id TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      fine_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS overdue_fines (
      id TEXT PRIMARY KEY,
      borrow_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      book_title TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT,
      overdue_days INTEGER NOT NULL DEFAULT 0,
      daily_rate REAL NOT NULL,
      calculated_amount REAL NOT NULL DEFAULT 0,
      waived_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      max_amount REAL NOT NULL DEFAULT 0,
      last_calculated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lost_books (
      id TEXT PRIMARY KEY,
      borrow_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      book_title TEXT NOT NULL,
      book_price REAL NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      reported_date TEXT NOT NULL,
      compensation_ratio REAL NOT NULL,
      compensation_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'reported',
      found_date TEXT,
      refund_amount REAL NOT NULL DEFAULT 0,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waivers (
      id TEXT PRIMARY KEY,
      fine_id TEXT,
      lost_book_id TEXT,
      waiver_type TEXT NOT NULL,
      original_amount REAL NOT NULL,
      waived_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      request_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_borrow_status ON borrow_records(status);
    CREATE INDEX IF NOT EXISTS idx_borrow_student ON borrow_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_book ON borrow_records(book_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_class ON borrow_records(class_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_due ON borrow_records(due_date);
    CREATE INDEX IF NOT EXISTS idx_fine_status ON overdue_fines(status);
    CREATE INDEX IF NOT EXISTS idx_fine_student ON overdue_fines(student_id);
    CREATE INDEX IF NOT EXISTS idx_lost_status ON lost_books(status);
    CREATE INDEX IF NOT EXISTS idx_lost_student ON lost_books(student_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
  `);
}

module.exports = {
  run: runSync,
  get: getSync,
  all: allSync,
  exec: execSync,
  initDatabase,
  rawDb: db
};
