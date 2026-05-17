const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'claim-notice.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    claim_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    policy_no TEXT,
    incident_type TEXT,
    incident_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS material_items (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    material_code TEXT NOT NULL,
    material_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  );

  CREATE TABLE IF NOT EXISTS notice_records (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    flow_type TEXT NOT NULL DEFAULT 'NORMAL',
    operator_id TEXT,
    operator_name TEXT,
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  );

  CREATE TABLE IF NOT EXISTS history_logs (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    notice_id TEXT,
    material_id TEXT,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    operator_id TEXT,
    operator_name TEXT,
    remark TEXT,
    flow_type TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conflict_records (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    notice_id TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    detected_by TEXT,
    description TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution TEXT,
    status TEXT NOT NULL DEFAULT 'DETECTED'
  );

  CREATE TABLE IF NOT EXISTS import_bad_rows (
    id TEXT PRIMARY KEY,
    import_batch_id TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    row_data TEXT NOT NULL,
    error_message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_material_claim ON material_items(claim_id);
  CREATE INDEX IF NOT EXISTS idx_notice_claim ON notice_records(claim_id);
  CREATE INDEX IF NOT EXISTS idx_history_claim ON history_logs(claim_id);
  CREATE INDEX IF NOT EXISTS idx_history_notice ON history_logs(notice_id);
  CREATE INDEX IF NOT EXISTS idx_conflict_claim ON conflict_records(claim_id);
`);

console.log('数据库初始化完成:', dbPath);
db.close();
