"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.initDatabase = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(process.cwd(), 'training.db');
const db = new sqlite3_1.default.Database(dbPath);
exports.db = db;
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          course_name TEXT NOT NULL,
          course_code TEXT NOT NULL,
          batch_number TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          total_students INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(course_code, batch_number)
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS course_rules (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          min_attendance_rate REAL NOT NULL DEFAULT 0.8,
          late_threshold_minutes INTEGER NOT NULL DEFAULT 30,
          late_penalty_score REAL NOT NULL DEFAULT 0,
          min_homework_score REAL NOT NULL DEFAULT 60,
          require_all_homework BOOLEAN NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          employee_id TEXT NOT NULL,
          name TEXT NOT NULL,
          department TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(batch_id, employee_id),
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS attendance_records (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          session_date TEXT NOT NULL,
          check_in_time TEXT,
          check_out_time TEXT,
          status TEXT NOT NULL DEFAULT 'normal',
          late_minutes INTEGER DEFAULT 0,
          is_makeup BOOLEAN DEFAULT 0,
          makeup_approved_by TEXT,
          makeup_approved_at TEXT,
          makeup_reason TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS homework_records (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          homework_name TEXT NOT NULL,
          score REAL,
          submitted_at TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS certificates (
          id TEXT PRIMARY KEY,
          certificate_number TEXT UNIQUE NOT NULL,
          student_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          issue_date TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          revoke_reason TEXT,
          revoked_by TEXT,
          revoked_at TEXT,
          final_score REAL,
          attendance_rate REAL,
          homework_avg_score REAL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS record_reviews (
          id TEXT PRIMARY KEY,
          record_type TEXT NOT NULL,
          record_id TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          action TEXT NOT NULL,
          reason TEXT NOT NULL,
          processed_by TEXT NOT NULL,
          processed_at TEXT NOT NULL,
          previous_status TEXT,
          new_status TEXT,
          FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          batch_id TEXT,
          student_id TEXT,
          certificate_id TEXT,
          action TEXT NOT NULL,
          details TEXT,
          operator TEXT NOT NULL,
          operated_at TEXT NOT NULL
        )
      `);
            db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_batch ON attendance_records(batch_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_homework_student ON homework_records(student_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_homework_batch ON homework_records(batch_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_batch ON certificates(batch_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_batch ON record_reviews(batch_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_record ON record_reviews(record_type, record_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_audit_batch ON audit_logs(batch_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_audit_student ON audit_logs(student_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_audit_certificate ON audit_logs(certificate_id)`);
        });
        resolve();
    });
};
exports.initDatabase = initDatabase;
