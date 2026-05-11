const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'membership.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    current_tier TEXT DEFAULT '普通会员',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tiers (
    name TEXT PRIMARY KEY,
    min_points INTEGER NOT NULL,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    period TEXT NOT NULL,
    reason TEXT,
    linked_transaction_id TEXT,
    status TEXT DEFAULT 'valid',
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT DEFAULT 'system',
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    period TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    calculated_tier TEXT,
    confirmed_tier TEXT,
    is_confirmed INTEGER DEFAULT 0,
    confirmed_at TEXT,
    confirmed_by TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(member_id, period)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settlement_runs (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL,
    status TEXT DEFAULT 'running',
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    error_message TEXT
  )`);

  const tiers = db.prepare('SELECT COUNT(*) as count FROM tiers');
  tiers.get((err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare('INSERT INTO tiers (name, min_points, description) VALUES (?, ?, ?)');
      stmt.run('普通会员', 0, '基础会员等级');
      stmt.run('银卡', 1000, '银卡会员 - 消费满1000积分保级');
      stmt.run('金卡', 3000, '金卡会员 - 消费满3000积分保级');
      stmt.run('黑卡', 10000, '黑卡会员 - 消费满10000积分保级');
      stmt.finalize();
    }
  });
});

module.exports = db;
