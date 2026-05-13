const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    status TEXT DEFAULT 'draft',
    author TEXT,
    current_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    search_index_status TEXT DEFAULT 'pending',
    read_feedback_score REAL,
    read_count INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS article_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    author TEXT,
    change_log TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    version_id INTEGER NOT NULL,
    reviewer TEXT NOT NULL,
    comment TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (version_id) REFERENCES article_versions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS publish_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    version_id INTEGER NOT NULL,
    publish_type TEXT NOT NULL,
    operator TEXT NOT NULL,
    before_value TEXT,
    after_value TEXT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (version_id) REFERENCES article_versions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rollback_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    from_version_id INTEGER NOT NULL,
    to_version_id INTEGER NOT NULL,
    operator TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (from_version_id) REFERENCES article_versions(id),
    FOREIGN KEY (to_version_id) REFERENCES article_versions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS read_feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    reader TEXT,
    score INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS manual_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER,
    operator TEXT NOT NULL,
    adjust_type TEXT NOT NULL,
    field_name TEXT,
    before_value TEXT,
    after_value TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
  )`);

  console.log('数据库表创建完成！');
});

db.close();
