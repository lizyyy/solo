import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data/callback_console.db');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS audio_tasks (
      id TEXT PRIMARY KEY,
      audio_url TEXT NOT NULL,
      audio_duration INTEGER,
      file_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transcription_stages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES audio_tasks(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS callback_targets (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      secret_key TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 5,
      last_callback_at DATETIME,
      next_retry_at DATETIME,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES audio_tasks(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS text_fragments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      speaker TEXT,
      start_time REAL,
      end_time REAL,
      content TEXT NOT NULL,
      confidence REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES audio_tasks(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS failure_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      target_id TEXT,
      stage TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      request_payload TEXT,
      response_data TEXT,
      responsibility_node TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES audio_tasks(id),
      FOREIGN KEY (target_id) REFERENCES callback_targets(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS retry_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      retry_number INTEGER NOT NULL,
      request_payload TEXT,
      response_data TEXT,
      status TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES audio_tasks(id),
      FOREIGN KEY (target_id) REFERENCES callback_targets(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES audio_tasks(id)
    )`);

    console.log('数据库表初始化完成');
  });
}

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const runExecute = (sql: string, params: any[] = []): Promise<{ lastID: any; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const runGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};
