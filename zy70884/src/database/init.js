const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/legal_tracking.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    applicant TEXT NOT NULL,
    department TEXT,
    apply_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    contract_no TEXT,
    contract_name TEXT NOT NULL,
    party_a TEXT,
    party_b TEXT,
    amount REAL,
    seal_type TEXT NOT NULL,
    authorizer TEXT,
    express_no TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'pending',
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS seal_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seal_type TEXT UNIQUE NOT NULL,
    description TEXT,
    authorized_persons TEXT,
    max_amount REAL,
    requires_attachment INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER,
    batch_id INTEGER,
    action_type TEXT NOT NULL,
    action_reason TEXT,
    handler TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_contracts_seal_type ON contracts(seal_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_contracts_authorizer ON contracts(authorizer)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_contracts_express_no ON contracts(express_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_contract_id ON audit_logs(contract_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_id ON audit_logs(batch_id)`);

  console.log('数据表创建完成');
});

db.close();
