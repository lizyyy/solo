import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/app.db');

export function initDatabase() {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      real_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT UNIQUE NOT NULL,
      version INTEGER DEFAULT 1,
      parent_batch_id TEXT,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      remark TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      frozen_at DATETIME,
      frozen_by TEXT,
      status_before_freeze TEXT,
      FOREIGN KEY (parent_batch_id) REFERENCES batches(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (frozen_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS raw_data_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      source_file TEXT NOT NULL,
      original_row_number INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      original_value TEXT NOT NULL,
      parsed_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS status_transitions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      transition_type TEXT NOT NULL,
      reason TEXT,
      operated_by TEXT NOT NULL,
      operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (operated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      original_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      reviewed_by TEXT NOT NULL,
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      evidence_attachments TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL,
      failure_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
    CREATE INDEX IF NOT EXISTS idx_batches_created_by ON batches(created_by);
    CREATE INDEX IF NOT EXISTS idx_raw_data_batch_id ON raw_data_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_transitions_batch_id ON status_transitions(batch_id);
    CREATE INDEX IF NOT EXISTS idx_review_batch_id ON review_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_batch_id ON attachments(batch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  
  if (userCount.count === 0) {
    const passwordHash = bcrypt.hashSync('123456', 10);
    
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, real_name)
      VALUES (?, ?, ?, ?, ?)
    `);

    const users = [
      { id: 'u001', username: 'cs001', role: 'customer_service', realName: '客服小王' },
      { id: 'u002', username: 'tech001', role: 'technician', realName: '李师傅' },
      { id: 'u003', username: 'review001', role: 'reviewer', realName: '复核专员老张' },
      { id: 'u004', username: 'pm001', role: 'project_manager', realName: '项目经理刘总' },
      { id: 'u005', username: 'finance001', role: 'finance', realName: '财务小陈' },
    ];

    for (const user of users) {
      insertUser.run(user.id, user.username, passwordHash, user.role, user.realName);
    }

    console.log('初始用户已创建，密码均为: 123456');
  }

  db.close();
  console.log('数据库初始化完成');
}

export function getDatabase() {
  return new Database(dbPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}
