const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'library.db'));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'approver', 'user')),
    max_secret_level INTEGER NOT NULL CHECK(max_secret_level IN (0, 1, 2, 3)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('contract', 'bid', 'technical')),
    secret_level INTEGER NOT NULL CHECK(secret_level IN (0, 1, 2, 3)),
    description TEXT,
    is_destroyed BOOLEAN DEFAULT 0,
    destroyed_at DATETIME,
    destroyed_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destroyed_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS borrow_records (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'borrowed', 'returned', 'overdue', 'destroyed')),
    request_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    approved_time DATETIME,
    due_time DATETIME,
    borrow_time DATETIME,
    return_time DATETIME,
    renew_count INTEGER DEFAULT 0,
    max_renew_count INTEGER NOT NULL DEFAULT 2,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS renew_requests (
    id TEXT PRIMARY KEY,
    borrow_record_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
    request_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    approved_time DATETIME,
    due_time_after_renew DATETIME,
    FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS overdue_handlings (
    id TEXT PRIMARY KEY,
    borrow_record_id TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('remind', 'penalty', 'force_return')),
    description TEXT,
    handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
    FOREIGN KEY (handler_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS destruction_records (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    confirmation_note TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
  );
`);

function seedData() {
  const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (adminExists) return;

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, role, max_secret_level)
    VALUES (?, ?, ?, ?, ?)
  `);

  const users = [
    { id: 'admin-001', username: 'admin', password: 'admin123', role: 'admin', max_secret_level: 3 },
    { id: 'approver-001', username: 'approver', password: 'approver123', role: 'approver', max_secret_level: 2 },
    { id: 'user-001', username: 'user', password: 'user123', role: 'user', max_secret_level: 1 },
  ];

  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(u.id, u.username, hash, u.role, u.max_secret_level);
  }

  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, type, secret_level, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  const docs = [
    { id: 'doc-001', title: '普通合同模板', type: 'contract', secret_level: 0, description: '公司标准合同模板' },
    { id: 'doc-002', title: '标书-项目A', type: 'bid', secret_level: 1, description: '项目A竞标标书' },
    { id: 'doc-003', title: '核心技术文档-系统架构', type: 'technical', secret_level: 2, description: '系统架构设计文档' },
    { id: 'doc-004', title: '绝密技术方案', type: 'technical', secret_level: 3, description: '公司核心技术方案' },
  ];

  for (const d of docs) {
    insertDoc.run(d.id, d.title, d.type, d.secret_level, d.description);
  }

  console.log('✅ 种子数据已初始化');
  console.log('默认账号:');
  console.log('  admin / admin123 (管理员, 密级3)');
  console.log('  approver / approver123 (审批人, 密级2)');
  console.log('  user / user123 (普通用户, 密级1)');
}

seedData();

module.exports = db;
