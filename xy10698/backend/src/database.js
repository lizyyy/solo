const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/knowledge_base.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reply_versions (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_current BOOLEAN DEFAULT 1,
      FOREIGN KEY (intent_id) REFERENCES intents(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS hit_records (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      reply_version_id TEXT NOT NULL,
      session_id TEXT,
      user_query TEXT NOT NULL,
      agent_id TEXT,
      adopted BOOLEAN DEFAULT 0,
      follow_up BOOLEAN DEFAULT 0,
      hit_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intent_id) REFERENCES intents(id),
      FOREIGN KEY (reply_version_id) REFERENCES reply_versions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS feedbacks (
      id TEXT PRIMARY KEY,
      hit_record_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      reported_by TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      merged_from TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hit_record_id) REFERENCES hit_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      reply_version_id TEXT,
      action TEXT NOT NULL,
      previous_content TEXT,
      new_content TEXT,
      revised_by TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intent_id) REFERENCES intents(id),
      FOREIGN KEY (reply_version_id) REFERENCES reply_versions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
