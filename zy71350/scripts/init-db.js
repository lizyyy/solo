const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_code TEXT UNIQUE NOT NULL,
    artist_name TEXT NOT NULL,
    artist_level TEXT DEFAULT 'DEFAULT',
    commission_rate REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS consignment_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    settlement_month TEXT NOT NULL,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    status TEXT DEFAULT 'created',
    source_file TEXT,
    imported_by TEXT DEFAULT 'system',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    remarks TEXT
  );

  CREATE TABLE IF NOT EXISTS consignment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    line_no INTEGER NOT NULL,
    artwork_no TEXT NOT NULL,
    artist_code TEXT NOT NULL,
    artist_name TEXT,
    exhibition_start_date TEXT NOT NULL,
    exhibition_end_date TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    listed_price REAL NOT NULL,
    transaction_price REAL NOT NULL,
    discount_rate REAL DEFAULT 0,
    declared_commission_rate REAL,
    raw_data TEXT NOT NULL,
    processing_order INTEGER,
    status TEXT DEFAULT 'imported',
    final_commission_rate REAL,
    final_commission_amount REAL,
    final_artist_amount REAL,
    validation_passed INTEGER DEFAULT 0,
    has_issues INTEGER DEFAULT 0,
    highest_severity TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES consignment_batches(id)
  );

  CREATE TABLE IF NOT EXISTS processing_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    batch_id INTEGER,
    step TEXT NOT NULL,
    action TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    rule_code TEXT,
    message TEXT NOT NULL,
    raw_value TEXT,
    expected_value TEXT,
    is_original INTEGER DEFAULT 0,
    is_processed INTEGER DEFAULT 0,
    operator TEXT DEFAULT 'system',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES consignment_items(id),
    FOREIGN KEY (batch_id) REFERENCES consignment_batches(id)
  );

  CREATE TABLE IF NOT EXISTS authorization_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    auth_type TEXT NOT NULL,
    auth_field TEXT NOT NULL,
    original_value REAL,
    requested_value REAL,
    authorized_value REAL,
    reason TEXT NOT NULL,
    authorized_by TEXT NOT NULL,
    authorized_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (item_id) REFERENCES consignment_items(id)
  );

  CREATE TABLE IF NOT EXISTS settlement_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    export_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    record_count INTEGER,
    total_commission REAL,
    total_artist_amount REAL,
    exported_by TEXT DEFAULT 'system',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES consignment_batches(id)
  );

  CREATE INDEX IF NOT EXISTS idx_items_batch ON consignment_items(batch_id);
  CREATE INDEX IF NOT EXISTS idx_items_artwork ON consignment_items(artwork_no);
  CREATE INDEX IF NOT EXISTS idx_items_artist ON consignment_items(artist_code);
  CREATE INDEX IF NOT EXISTS idx_items_status ON consignment_items(status);
  CREATE INDEX IF NOT EXISTS idx_logs_item ON processing_logs(item_id);
  CREATE INDEX IF NOT EXISTS idx_logs_batch ON processing_logs(batch_id);
  CREATE INDEX IF NOT EXISTS idx_auth_item ON authorization_records(item_id);
`);

const insertArtist = db.prepare(`
  INSERT OR IGNORE INTO artists (artist_code, artist_name, artist_level, commission_rate)
  VALUES (?, ?, ?, ?)
`);

const sampleArtists = [
  ['A001', '张艺涵', 'ESTABLISHED', 0.35],
  ['A002', '李明远', 'EMERGING', 0.25],
  ['A003', '王思齐', 'MASTER', 0.40],
  ['A004', '陈雨萱', 'DEFAULT', 0.30],
  ['A005', '刘子墨', 'EMERGING', 0.25]
];

const transaction = db.transaction((artists) => {
  for (const artist of artists) {
    insertArtist.run(...artist);
  }
});

transaction(sampleArtists);

console.log('✓ 数据库初始化完成');
console.log(`✓ 数据库位置: ${config.DB_PATH}`);
console.log('✓ 已预置5位艺术家基础数据');

db.close();
