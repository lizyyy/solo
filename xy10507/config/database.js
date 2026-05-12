const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/ad-material.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    parent_version_id TEXT,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    creator TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
    FOREIGN KEY (parent_version_id) REFERENCES materials (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS material_channels (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    budget REAL NOT NULL DEFAULT 0,
    spent REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    review_status TEXT NOT NULL DEFAULT 'pending',
    review_reason TEXT,
    review_by TEXT,
    review_at DATETIME,
    is_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials (id),
    FOREIGN KEY (channel_id) REFERENCES channels (id),
    UNIQUE (material_id, channel_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    material_channel_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    operator TEXT,
    extra TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_channel_id) REFERENCES material_channels (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rollback_records (
    id TEXT PRIMARY KEY,
    material_channel_id TEXT NOT NULL,
    from_material_id TEXT NOT NULL,
    to_material_id TEXT NOT NULL,
    operator TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_channel_id) REFERENCES material_channels (id),
    FOREIGN KEY (from_material_id) REFERENCES materials (id),
    FOREIGN KEY (to_material_id) REFERENCES materials (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS performance_data (
    id TEXT PRIMARY KEY,
    material_channel_id TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    record_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_channel_id) REFERENCES material_channels (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotent_records (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
    id TEXT PRIMARY KEY,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    operator TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
