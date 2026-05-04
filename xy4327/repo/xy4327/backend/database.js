const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'subtitle-proofreader.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 项目表
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 字幕段表
  db.run(`
    CREATE TABLE IF NOT EXISTS subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      start_seconds REAL NOT NULL,
      end_seconds REAL NOT NULL,
      original_text TEXT NOT NULL,
      current_text TEXT NOT NULL,
      speaker TEXT,
      is_reviewed BOOLEAN DEFAULT 0,
      issues TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )
  `);

  // 术语表
  db.run(`
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      term TEXT NOT NULL,
      replacement TEXT,
      category TEXT,
      is_sensitive BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )
  `);

  // 说话人表
  db.run(`
    CREATE TABLE IF NOT EXISTS speakers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      alias TEXT,
      is_sensitive BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id)
    )
  `);

  // 校对记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS proofread_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      subtitle_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (subtitle_id) REFERENCES subtitles (id)
    )
  `);

  // 检测结果表
  db.run(`
    CREATE TABLE IF NOT EXISTS detection_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      subtitle_id INTEGER,
      issue_type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      message TEXT NOT NULL,
      details TEXT,
      is_resolved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (subtitle_id) REFERENCES subtitles (id)
    )
  `);
});

module.exports = db;