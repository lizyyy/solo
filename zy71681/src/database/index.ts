import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'music_listening.db');

let db: sqlite3.Database;

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      createTables().then(resolve).catch(reject);
    });
  });
};

const createTables = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const tables = [
        `CREATE TABLE IF NOT EXISTS classes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL,
          name TEXT NOT NULL,
          student_no TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (class_id) REFERENCES classes(id)
        )`,
        `CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          practice_date TEXT NOT NULL,
          type TEXT NOT NULL,
          question_no INTEGER NOT NULL,
          standard_answer TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS answer_submissions (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          question_id TEXT NOT NULL,
          student_answer TEXT NOT NULL,
          practice_date TEXT NOT NULL,
          submitted_at TEXT NOT NULL,
          graded_at TEXT,
          is_correct INTEGER,
          score INTEGER,
          status TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          notes TEXT,
          FOREIGN KEY (student_id) REFERENCES students(id),
          FOREIGN KEY (question_id) REFERENCES questions(id)
        )`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          operator TEXT,
          timestamp TEXT NOT NULL,
          description TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS detection_issues (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          submission_id TEXT,
          question_id TEXT,
          description TEXT NOT NULL,
          details TEXT NOT NULL,
          is_resolved INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          resolved_at TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS report_attachments (
          id TEXT PRIMARY KEY,
          report_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_data TEXT NOT NULL,
          uploaded_at TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_submissions_idempotency ON answer_submissions(idempotency_key)`,
        `CREATE INDEX IF NOT EXISTS idx_submissions_date ON answer_submissions(practice_date)`,
        `CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(practice_date)`
      ];

      let completed = 0;
      tables.forEach((sql, index) => {
        db.run(sql, (err) => {
          if (err) {
            reject(err);
            return;
          }
          completed++;
          if (completed === tables.length) {
            resolve();
          }
        });
      });
    });
  });
};

export const getDb = (): sqlite3.Database => db;

export const runQuery = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const allQuery = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};
