const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'appeal.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    content_text TEXT,
    content_url TEXT,
    author_id TEXT,
    author_name TEXT,
    block_time DATETIME NOT NULL,
    content_status TEXT DEFAULT 'blocked',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL,
    tag_code TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    confidence REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS model_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    reason_detail TEXT,
    risk_level TEXT DEFAULT 'medium',
    evidence_snippets TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appeals (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    submitter_id TEXT,
    submitter_name TEXT,
    submitter_contact TEXT,
    appeal_reason TEXT NOT NULL,
    evidence_materials TEXT,
    status TEXT DEFAULT 'pending',
    assignee_id TEXT,
    assignee_name TEXT,
    disposal_type TEXT,
    disposal_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appeal_id TEXT NOT NULL,
    action TEXT NOT NULL,
    operator_id TEXT,
    operator_name TEXT,
    remark TEXT,
    old_status TEXT,
    new_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviewers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    is_active BOOLEAN DEFAULT 1,
    workload INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_content_id ON appeals(content_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_trail_appeal_id ON audit_trail(appeal_id)`);

  const reviewerStmt = db.prepare(`INSERT OR IGNORE INTO reviewers (id, name, email, department) VALUES (?, ?, ?, ?)`);
  reviewerStmt.run('r1', '张三', 'zhangsan@example.com', '审核一组');
  reviewerStmt.run('r2', '李四', 'lisi@example.com', '审核二组');
  reviewerStmt.run('r3', '王五', 'wangwu@example.com', '审核一组');
  reviewerStmt.finalize();
  console.log('默认审核员数据已初始化');

  console.log('数据库表初始化完成');
});

db.close();
