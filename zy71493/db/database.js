const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbInstance = null;

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
}

function getDb() {
  if (!dbInstance) {
    throw new Error('数据库未初始化');
  }
  return dbInstance;
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    ensureDirectories();

    const isNewDb = !fs.existsSync(DB_PATH);

    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('SQLite 数据库连接成功');

      dbInstance.serialize(() => {
        dbInstance.run(`PRAGMA foreign_keys = ON`);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_type TEXT NOT NULL CHECK(question_type IN ('interval', 'chord', 'rhythm')),
            title TEXT NOT NULL,
            audio_file TEXT,
            standard_answer TEXT NOT NULL,
            description TEXT,
            difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
            tags TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
          )
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS answer_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            student_answer TEXT,
            is_correct INTEGER,
            submit_time TEXT DEFAULT (datetime('now', 'localtime')),
            answer_source TEXT DEFAULT 'normal' CHECK(answer_source IN ('normal', 'makeup', 'withdrawn', 'duplicate')),
            original_answer_id INTEGER,
            remark TEXT,
            is_missing_fields INTEGER DEFAULT 0,
            missing_fields TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
          )
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS error_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            answer_id INTEGER NOT NULL UNIQUE,
            question_id INTEGER NOT NULL,
            error_type TEXT NOT NULL CHECK(error_type IN ('interval', 'chord', 'rhythm', 'other')),
            error_category TEXT NOT NULL,
            student_answer TEXT,
            standard_answer TEXT,
            answer_comparison TEXT,
            is_resolved INTEGER DEFAULT 0,
            resolved_at TEXT,
            resolved_note TEXT,
            practice_count INTEGER DEFAULT 1,
            last_practice_time TEXT DEFAULT (datetime('now', 'localtime')),
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            remark TEXT,
            FOREIGN KEY (answer_id) REFERENCES answer_records(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
          )
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('enharmonic_judge', 'type_misclassify', 'duplicate_unmerged', 'other')),
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected', 'resolved')),
            answer_id INTEGER,
            question_id INTEGER,
            related_answer_ids TEXT,
            description TEXT NOT NULL,
            detail TEXT,
            handled_by TEXT,
            handled_at TEXT,
            handle_note TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
          )
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS practice_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            answer_id INTEGER,
            student_answer TEXT,
            is_correct INTEGER,
            operation_type TEXT NOT NULL CHECK(operation_type IN ('submit', 'makeup', 'withdraw', 'update', 'retry', 'duplicate')),
            operator TEXT DEFAULT 'teacher',
            operation_time TEXT DEFAULT (datetime('now', 'localtime')),
            before_data TEXT,
            after_data TEXT,
            remark TEXT,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
          )
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS correction_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_table TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            reason TEXT NOT NULL,
            operator TEXT DEFAULT 'teacher',
            corrected_at TEXT DEFAULT (datetime('now', 'localtime')),
            remark TEXT
          )
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_answer_question ON answer_records(question_id)
        `);
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_error_question ON error_records(question_id)
        `);
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_error_type ON error_records(error_type)
        `);
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomalies(status)
        `);
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_history_question ON practice_history(question_id)
        `);
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_correction_target ON correction_history(target_table, target_id)
        `);

        if (isNewDb) {
          console.log('新数据库，正在初始化样例数据...');
          require('./seed-data')(dbInstance, (seedErr) => {
            if (seedErr) {
              console.error('样例数据初始化失败:', seedErr);
            } else {
              console.log('样例数据初始化完成');
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
}

module.exports = {
  initDatabase,
  getDb,
  DATA_DIR,
  DB_PATH,
  AUDIO_DIR
};
